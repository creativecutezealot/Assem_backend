/// Routing user management
const R = require('ramda');
const pass_hash = require('password-hash');
const uidGenerator = require('node-unique-id-generator');
const passwordGenerator = require('generate-password');
const phoneToken = require('generate-sms-verification-code');
const express = require('express');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { userInfo } = require('os');
const dbClient = require('../utils/dbClient');
const utils = require('../utils/utils');
const notification = require('../utils/notificaion');
const mqttClient = require('../socket');
const new_utils = require('../utils/new_utils');
const sendMail = require('../utils/email');
const manageAudio = require('../manageAudio');
const manageVoiceNote = require('../manageVoiceNote');
const models = require('../model/index');
const smsManager = require('../utils/sms');

const { TBLNAME } = process.env;
const PRI_KEY = 'USER';
const USER_SORT_KEY = 'METADATA';
const LIKE_SORT_KEY = 'LIKE';
const CONNECT_SORT_KEY = 'CONNECT';
const USEREMAILINDEXNAME = 'email-index';
const USERFORGOTTOKENINDEXNAME = 'forgot_token-index';
const INVERTEDINDEXNAME = 'inverted-index';
const TABLEINDEXNAME = 'table_name-index';
const MQTT_LIKE_TOPIC = `presence/${process.env.MQTT_USERNAME}/like/user`;
const MQTT_UPDATE_TOPIC = `presence/${process.env.MQTT_USERNAME}/presence/user`;
const adminString = 'admin';
const managerString = 'manager';

function health(req, res) {
    res.send('OK');
}
async function healthNotification(req, res) {
    const { token } = req.body;
    const message = 'test';
    notification.sendMultiNotification([token], message);
    utils.sendResult(200, { status: true }, res);
}

async function findUser(email) {
    const findparams = {
        TableName: TBLNAME,
        IndexName: USEREMAILINDEXNAME,
        KeyConditionExpression: 'email = :emailstr',
        ExpressionAttributeValues: {
            ':emailstr': email,
        },
    };
    try {
        return await dbClient.getItems(findparams);
    } catch (error) {
        return error;
    }
}

// create user
async function createuser(req, res) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('email', 'Email cannot be blank').notEmpty();
    req.sanitize('email').normalizeEmail({ gmail_remove_dots: false });
    req.assert('password', 'Password must be at least 6 characters long').len(
        6
    );
    const errors = req.validationErrors();
    if (errors) {
        utils.sendResult(400, { status: false, data: errors[0].msg }, res);
        return;
    }
    try {
        const password = pass_hash.generate(
            req.body.password ? req.body.password : '111111'
        );
        createUserWithVCode(req.body.email, '', password, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function createUserWithVCode(email, phone, password, res) {
    try {
        const resultFind = await findUser(email);
        console.log(resultFind);
        if (resultFind.Count > 0) {
            utils.sendResult(
                200,
                {
                    status: false,
                    data: 'Hmm, Your email already registered. Please login.',
                },
                res
            );
        } else {
            const userid = uidGenerator.generateGUID();
            const token = jwt.sign({ userid }, process.env.JWTSECRET, {
                expiresIn: '30d',
            });
            const createPayload = {
                user_id: userid,
                email,
                password,
                phone_number: phone || '',
                api_token: token,
                forgot_token: ' ',
                table_name: PRI_KEY,
            };
            const createRes = await new_utils.createData(
                PRI_KEY,
                userid,
                USER_SORT_KEY,
                userid,
                createPayload,
                models.user
            );
            if (createRes.data) {
                utils.sendResult(
                    201,
                    { status: true, data: createRes.data },
                    res
                );
            } else {
                utils.sendResult(
                    400,
                    { status: false, data: createRes.error },
                    res
                );
            }
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function createUserFromAdmin(req, res) {
    try {
        req.assert('email', 'Email is not valid').isEmail();
        req.assert('email', 'Email cannot be blank').notEmpty();
        req.sanitize('email').normalizeEmail({ gmail_remove_dots: false });
        const resultFind = await findUser(req.body.email);
        console.log(resultFind);
        if (resultFind.Count > 0) {
            utils.sendResult(
                200,
                {
                    status: false,
                    data: 'Hmm, Your email already registered. Please login.',
                },
                res
            );
        } else {
            const userid = uidGenerator.generateGUID();
            const password = passwordGenerator.generate({
                length: 10,
                numbers: true,
            });
            const passwordHash = pass_hash.generate(password);

            const token = jwt.sign({ userid }, process.env.JWTSECRET, {
                expiresIn: '30d',
            });
            const createPayload = {
                user_id: userid,
                api_token: token,
                forgot_token: ' ',
                table_name: PRI_KEY,
                password: passwordHash,
                ...req.body,
            };
            const userName = `${req.body.first_name} ${req.body.last_name}`;
            const emailOption = {
                to: [req.body.email],
                from: 'info@assembly.us',
                subject: 'Assembly account',
                text: 'Assembly account',
                html: `Hi ${userName},
                <br/><br/> We added your Assembly Account.
                <br/><br/> Your password is <strong>${password}</strong>. 
                <br/><br/> Please change the password when you login first time.`,
            };
            await sendMail.sendEmail(emailOption);
            const createRes = await new_utils.createData(
                PRI_KEY,
                userid,
                USER_SORT_KEY,
                userid,
                createPayload,
                models.user
            );
            if (createRes.data) {
                utils.sendResult(
                    201,
                    { status: true, data: createRes.data },
                    res
                );
            } else {
                utils.sendResult(
                    400,
                    { status: false, data: createRes.error },
                    res
                );
            }
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function verifyEmail(email) {
    try {
        const resultFind = await findUser(email);
        if (resultFind.Count > 0) {
            const userid = resultFind.Items[0].user_id;
            const updateRes = await new_utils.updateData(
                PRI_KEY,
                userid,
                USER_SORT_KEY,
                userid,
                {
                    verified: true,
                },
                models.user
            );
            return true;
        }
        return false;
    } catch (error) {
        console.log(error);
        return false;
    }
}

/// update user all information
async function updateuser(req, res) {
    try {
        const { userid } = req.body;
        const { body } = req;
        if (
            Object.prototype.hasOwnProperty.call(body, 'current_password') &&
            Object.prototype.hasOwnProperty.call(body, 'password')
        ) {
            const getRes = await new_utils.getData(
                PRI_KEY,
                userid,
                USER_SORT_KEY,
                userid
            );
            // const current_password = await pass_hash.generate(req.body.current_password);
            if (
                !pass_hash.verify(body.current_password, getRes.data.password)
            ) {
                utils.sendResult(
                    400,
                    { status: false, data: 'Current Password is incorrect' },
                    res
                );
                return;
            }
            body.password = await pass_hash.generate(req.body.password);
        }
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            userid,
            USER_SORT_KEY,
            userid,
            body,
            models.user
        );
        if (
            req.body &&
            Object.prototype.hasOwnProperty.call(req.body, 'loggedin') &&
            String(req.body.loggedin) === 'true'
        ) {
            createVoiceNotesForNewUsers(userid);
        }
        mqttClient.publishTopic(MQTT_UPDATE_TOPIC, {
            ...updateRes.data,
        });
        if (updateRes.data) {
            utils.sendResult(200, { status: true, data: updateRes.data }, res);
        } else {
            utils.sendResult(
                400,
                { status: false, data: updateRes.error },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

/// update user all information
async function updateuserwithid(req, res) {
    try {
        const { userid } = req.params;
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            userid,
            USER_SORT_KEY,
            userid,
            req.body,
            models.user
        );
        if (
            req.body &&
            Object.prototype.hasOwnProperty.call(req.body, 'loggedin') &&
            String(req.body.loggedin) === 'true'
        ) {
            createVoiceNotesForNewUsers(userid);
        }
        mqttClient.publishTopic(MQTT_UPDATE_TOPIC, {
            ...updateRes.data,
        });
        if (updateRes.data) {
            utils.sendResult(200, { status: true, data: updateRes.data }, res);
        } else {
            utils.sendResult(
                400,
                { status: false, data: updateRes.error },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function createVoiceNotesForNewUsers(receiver_id) {
    const allAudios = await manageAudio.getAllAudios();
    if (allAudios && allAudios.length > 0) {
        for (const audio of allAudios) {
            if (audio.is_sent_message) {
                await manageVoiceNote.createVoiceNoteWithAudio(
                    receiver_id,
                    audio
                );
            }
        }
    }
}

/// update user part information
async function updateuserpass(req, res) {
    try {
        req.assert('password', 'Password cannot be blank').notEmpty();
        const errors = req.validationErrors();
        if (errors) {
            utils.sendResult(400, { status: false, data: errors[0].msg }, res);
            return;
        }
        const password = pass_hash.generate(
            req.body.password ? req.body.password : '111111'
        );
        const userid = req.params.user_id;
        const updatePayload = {
            password,
        };
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            userid,
            USER_SORT_KEY,
            userid,
            updatePayload,
            models.user
        );
        if (updateRes.data) {
            utils.sendResult(200, { status: true, data: updateRes.data }, res);
        } else {
            utils.sendResult(
                400,
                { status: false, data: updateRes.error },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

// user login
async function login(req, res) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('email', 'Email cannot be blank').notEmpty();
    req.assert('password', 'Password cannot be blank').notEmpty();
    req.sanitize('email').normalizeEmail({ gmail_remove_dots: false });
    const errors = req.validationErrors();
    if (errors) {
        utils.sendResult(400, { status: false, data: errors[0].msg }, res);
        return;
    }
    try {
        const result = await findUser(req.body.email);
        if (result.Count > 0) {
            const user = result.Items[0];
            const algorithm = 'aes-256-cbc';
            const iv = '0123456789abcdef0123456789abcdef';
            const key = '591825e3a4f2c9b8f73eb963c77ad160d4802ad7aadc179b066275bcb9d9cfd2';        
            let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
            let decrypted = decipher.update(req.body.password, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            let decryptedPassword = decrypted.toString('hex'); 
            if (pass_hash.verify(decryptedPassword, user.password)) {
                const token = jwt.sign(
                    { userid: user.user_id, user_role: user.user_role },
                    process.env.JWTSECRET,
                    {
                        expiresIn: '30d',
                    }
                );
                const resultUpdateToken = await updateAuthToken(
                    user,
                    'api_token',
                    token
                );
                if (resultUpdateToken) {
                    user.api_token = token;
                    utils.sendResult(
                        200,
                        { status: true, token, data: user },
                        res
                    );
                } else {
                    utils.sendResult(
                        200,
                        {
                            status: false,
                            data: 'Incorrect password, please check again.',
                        },
                        res
                    );
                }
            } else {
                utils.sendResult(
                    200,
                    {
                        status: false,
                        data: 'Incorrect password, please check again.',
                    },
                    res
                );
            }
        } else {
            utils.sendResult(
                200,
                {
                    status: false,
                    data: 'User does not exist, Please check your email address.',
                },
                res
            );
        }
    } catch (error) {
        console.log('error: ', error);
        utils.sendResult(404, { status: false, data: error }, res);
    }
}



// get user by id
async function getuser(req, res) {
    const userid = req.params.user_id;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            userid,
            USER_SORT_KEY,
            userid
        );
        if (getRes.data) {
            utils.sendResult(201, { status: true, data: getRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

/// get all user function
async function getallusers(req, res) {
    try {
        const findparams = {
            TableName: TBLNAME,
            IndexName: TABLEINDEXNAME,
            KeyConditionExpression: 'table_name = :table_name',
            ExpressionAttributeValues: {
                ':table_name': PRI_KEY,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        const sortedUsers = resultFind.Items.sort(
            (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
        );
        utils.sendResult(200, { status: true, data: sortedUsers }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function deleteUser(req, res) {
    req.assert('userid', 'Email cannot be blank').notEmpty();
    const errors = req.validationErrors();
    if (errors) {
        utils.sendResult(400, { status: false, data: errors[0].msg }, res);
        return;
    }
    const userid = req.params.user_id;
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            userid,
            USER_SORT_KEY,
            userid
        );
        if (delRes.data) {
            utils.sendResult(201, { status: true, data: delRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: delRes.error }, res);
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

// add userid in connect
async function connectUserid(req, res) {
    try {
        const { opposite_id } = req.body;
        const { club_id } = req.body;
        const { userid } = req.body;
        const createPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            `${userid}_${club_id}`,
            CONNECT_SORT_KEY,
            `${opposite_id}_${club_id}`,
            createPayload,
            models.user_connect
        );
        if (createRes.data) {
            utils.sendResult(200, { status: true, data: createRes.data }, res);
        } else {
            utils.sendResult(
                400,
                { status: false, data: createRes.error },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

// del userid in connect
async function delConnectUserid(req, res) {
    try {
        const { opposite_id } = req.params;
        const { club_id } = req.params;
        const { userid } = req.body;
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            `${userid}_${club_id}`,
            CONNECT_SORT_KEY,
            `${opposite_id}_${club_id}`
        );
        if (delRes.data) {
            utils.sendResult(200, { status: true, data: delRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: delRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}
async function getConnectByUserId(req, res) {
    try {
        const { opposite_id } = req.params;
        const { userid } = req.body;
        const { club_id } = req.params;
        const getRes = await new_utils.getData(
            PRI_KEY,
            `${userid}_${club_id}`,
            CONNECT_SORT_KEY,
            `${opposite_id}_${club_id}`
        );
        if (getRes.data) {
            utils.sendResult(200, { status: true, data: getRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(404, { status: false, data: 'no data' }, res);
    }
}

async function getConnectsByUserId(req, res) {
    try {
        const userid = req.params.user_id;
        const { club_id } = req.params;
        const queryRes = await new_utils.queryData(
            PRI_KEY,
            `${userid}_${club_id}`,
            CONNECT_SORT_KEY
        );
        if (queryRes.data) {
            /// After queried, we need to get data with userIds
            const user = await new_utils.getData(
                PRI_KEY,
                userid,
                USER_SORT_KEY,
                userid
            );
            let users = [];
            if (queryRes.data && queryRes.data.length > 0) {
                const normalizedData = queryRes.data.map((a) => ({
                    sort_key: a.sort_key.replace(`_${club_id}`, ''),
                    pri_key: a.pri_key.replace(`_${club_id}`, ''),
                }));
                const batchRes = await new_utils.batchConnectGetData(
                    PRI_KEY,
                    USER_SORT_KEY,
                    normalizedData,
                    false
                );
                users = batchRes.data;
            }
            utils.sendResult(
                200,
                { status: true, data: user.data, connect: users },
                res
            );
        } else {
            utils.sendResult(400, { status: false, data: queryRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(404, { status: false, data: 'no data' }, res);
    }
}
/// / get users by connect userId
async function getUsersByOpoositeId(req, res) {
    try {
        const { opposite_id } = req.params;
        const { club_id } = req.params;
        const queryRes = await new_utils.queryInvertData(
            PRI_KEY,
            CONNECT_SORT_KEY,
            `${opposite_id}_${club_id}`
        );
        if (queryRes.data) {
            const user = await new_utils.getData(
                PRI_KEY,
                opposite_id,
                USER_SORT_KEY,
                opposite_id
            );
            let users = [];
            if (queryRes.data && queryRes.data.length > 0) {
                const normalizedData = queryRes.data.map((a) => ({
                    sort_key: a.sort_key.replace(`_${club_id}`, ''),
                    pri_key: a.pri_key.replace(`_${club_id}`, ''),
                }));
                const batchRes = await new_utils.batchConnectGetData(
                    PRI_KEY,
                    USER_SORT_KEY,
                    normalizedData,
                    true
                );
                users = batchRes.data;
            }
            utils.sendResult(
                200,
                { status: true, data: user.data, connect: users },
                res
            );
        } else {
            utils.sendResult(400, { status: false, data: queryRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

// update the token
async function updateAuthToken(user, key, value) {
    try {
        const keyModel = utils.createKeyModel(
            PRI_KEY,
            user.user_id,
            USER_SORT_KEY,
            user.user_id
        );
        const update_object = {};
        update_object[key] = value;
        const { expression, arttributeValues } = utils.generateUpdateDataModel(
            update_object,
            models.user
        );
        const updateParams = {
            TableName: TBLNAME,
            Key: keyModel,
            UpdateExpression: expression,
            ExpressionAttributeValues: arttributeValues,
            ReturnValues: 'ALL_NEW',
        };
        const resultUpdateAuth = await dbClient.updateItem(updateParams);
        return true;
    } catch (error) {
        console.error('Update Auth tokens error', error.toString());
        return false;
    }
}

async function forgotpass(req, res) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('email', 'Email cannot be blank').notEmpty();
    req.sanitize('email').normalizeEmail({ gmail_remove_dots: false });
    const errors = req.validationErrors();
    if (errors) {
        utils.sendResult(400, { status: false, data: errors[0].msg }, res);
        return;
    }
    const { email } = req.body;
    try {
        const resultUser = await findUser(email);
        if (resultUser.Count > 0) {
            const user = resultUser.Items[0];
            const token = phoneToken(6, { type: 'number' });
            console.log('token: ', token, email);
            const resultUpdateToken = await updateAuthToken(
                user,
                'forgot_token',
                `${token}`
            );
            const emailOption = {
                to: [email],
                from: 'info@assembly.us',
                subject: 'Assembly verification code',
                text: 'Assembly verification code',
                html: `Hi ${user.first_name}, 
                <br/><br/> We received your request to reset the password on your Assembly Account.
                <br/><br/> <strong>${token}</strong> 
                <br/><br/> Enter this code to complete the password reset. 
                <br/><br/> Thank you for helping us to keep your account secure.`,
            };
            await sendMail.sendEmail(emailOption);
            utils.sendResult(200, { status: true }, res);
        } else {
            utils.sendResult(
                200,
                {
                    status: false,
                    data: "Hmm, we don't recognize that email. Please try again",
                },
                res
            );
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function confirmCodePass(req, res) {
    req.assert('token', 'Token cannot be blank').notEmpty();
    const errors = req.validationErrors();
    if (errors) {
        utils.sendResult(400, { status: false, data: errors[0].msg }, res);
        return;
    }
    const { token } = req.body;
    const findparams = {
        TableName: TBLNAME,
        IndexName: USERFORGOTTOKENINDEXNAME,
        KeyConditionExpression: 'forgot_token = :tokenStr',
        ExpressionAttributeValues: {
            ':tokenStr': token,
        },
    };
    try {
        const resultUser = await dbClient.getItems(findparams);
        if (resultUser.Count > 0) {
            const user = resultUser.Items[0];
            if (user.forgot_token == token) {
                const resultUpdateToken = await updateAuthToken(
                    user,
                    'forgot_token',
                    ''
                );
                utils.sendResult(
                    200,
                    { status: true, data: user.user_id },
                    res
                );
            } else {
                utils.sendResult(
                    200,
                    {
                        status: false,
                        data: 'Hmm, that’s not the right code. Please try again.',
                    },
                    res
                );
            }
        } else {
            utils.sendResult(
                200,
                {
                    status: false,
                    data: 'Hmm, that’s not the right code. Please try again.',
                },
                res
            );
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

/// admin login api
async function adminlogin(req, res) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('email', 'Email cannot be blank').notEmpty();
    req.assert('password', 'Password cannot be blank').notEmpty();
    req.sanitize('email').normalizeEmail({ gmail_remove_dots: false });
    const errors = req.validationErrors();
    if (errors) {
        utils.sendResult(400, { status: false, data: errors[0].msg }, res);
        return;
    }
    try {
        const result = await findUser(req.body.email);
        if (result.Count > 0) {
            const user = result.Items[0];
            console.log(user);
            if (pass_hash.verify(req.body.password, user.password)) {
                const token = jwt.sign(
                    { userid: user.user_id, user_role: user.user_role },
                    process.env.JWTSECRET,
                    {
                        expiresIn: '30d',
                    }
                );
                const resultUpdateToken = await updateAuthToken(
                    user,
                    'api_token',
                    token
                );
                if (resultUpdateToken) {
                    user.api_token = token;
                    utils.sendResult(
                        200,
                        { status: true, token, data: user },
                        res
                    );
                } else {
                    utils.sendResult(
                        200,
                        {
                            status: false,
                            data: 'Incorrect password, please check again.',
                        },
                        res
                    );
                }
            } else {
                utils.sendResult(
                    200,
                    {
                        status: false,
                        data: 'Incorrect password, please check again.',
                    },
                    res
                );
            }
        } else {
            utils.sendResult(
                200,
                {
                    status: false,
                    data: 'User does not exist, Please check your email address.',
                },
                res
            );
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

/// admin signup api
async function adminsignup(req, res) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('email', 'Email cannot be blank').notEmpty();
    req.sanitize('email').normalizeEmail({ gmail_remove_dots: false });
    req.assert('password', 'Password must be at least 6 characters long').len(
        6
    );
    const errors = req.validationErrors();
    if (errors) {
        utils.sendResult(400, { status: false, data: errors[0].msg }, res);
        return;
    }
    try {
        const password = pass_hash.generate(
            req.body.password ? req.body.password : '111111'
        );
        const { body } = req;
        body.password = password;
        signupUser(body, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function signupUser(body, res) {
    const { email } = body;
    const { password } = body;
    const phone = '';
    const { firstname } = body;
    const { lastname } = body;
    const { username } = body;

    try {
        const resultFind = await findUser(email);
        console.log('resultFind', resultFind);
        if (resultFind.Count > 0) {
            const user = resultFind.Items[0];
            if (user.approved) {
                utils.sendResult(
                    200,
                    {
                        status: false,
                        data: 'Hmm, Your email already registered. Please login.',
                    },
                    res
                );
                return;
            }

            const userid = user.user_id;
            const token = jwt.sign({ userid }, process.env.JWTSECRET, {
                expiresIn: '30d',
            });
            const updatePayload = {
                user_id: userid,
                password,
                username,
                first_name: firstname,
                last_name: lastname,
                phone_number: phone || '',
                api_token: token,
                forgot_token: ' ',
                onboarding: 'email',
                table_name: PRI_KEY,
            };
            const updateRes = await new_utils.updateData(
                PRI_KEY,
                userid,
                USER_SORT_KEY,
                userid,
                updatePayload,
                models.user
            );
            if (updateRes.data) {
                await smsManager.sendEmailCode(email, (sendResult) => {
                    console.log('sendResult: ', sendResult);
                    if (sendResult && sendResult.status === 'pending') {
                        console.log('sendResult Status: ', sendResult);
                        utils.sendResult(
                            201,
                            { status: true, data: updateRes.data },
                            res
                        );
                    } else {
                        utils.sendResult(
                            201,
                            { status: true, data: null },
                            res
                        );
                    }
                });
            } else {
                utils.sendResult(
                    400,
                    { status: false, data: updateRes.error },
                    res
                );
            }
        } else {
            const userid = uidGenerator.generateGUID();
            const token = jwt.sign({ userid }, process.env.JWTSECRET, {
                expiresIn: '30d',
            });
            const createPayload = {
                user_id: userid,
                email,
                password,
                username,
                first_name: firstname,
                last_name: lastname,
                phone_number: phone || '',
                api_token: token,
                forgot_token: ' ',
                table_name: PRI_KEY,
            };
            const createRes = await new_utils.createData(
                PRI_KEY,
                userid,
                USER_SORT_KEY,
                userid,
                createPayload,
                models.user
            );
            if (createRes.data) {
                await smsManager.sendEmailCode(email, (sendResult) => {
                    console.log('sendResult: ', sendResult);
                    if (
                        sendResult.status !== null &&
                        sendResult.status === 'pending'
                    ) {
                        console.log('sendResult Status: ', sendResult);
                        utils.sendResult(
                            201,
                            { status: true, data: createRes.data },
                            res
                        );
                    } else {
                        utils.sendResult(
                            201,
                            { status: true, data: null },
                            res
                        );
                    }
                });
            } else {
                utils.sendResult(
                    400,
                    { status: false, data: createRes.error },
                    res
                );
            }
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function createLikeGained(req, res) {
    try {
        const { opposite_id } = req.body;
        const { userid } = req.body;
        const count = Number(req.body.likes_gained);
        let result;
        if (count > 0) {
            const createPayload = {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            result = await new_utils.createData(
                PRI_KEY,
                opposite_id,
                LIKE_SORT_KEY,
                userid,
                createPayload,
                models.user_connect
            );
        } else {
            result = await new_utils.deleteData(
                PRI_KEY,
                opposite_id,
                LIKE_SORT_KEY,
                userid
            );
        }
        mqttClient.publishTopic(MQTT_LIKE_TOPIC, {
            opposite_id,
            user_id: userid,
            count,
            created_at: new Date().getTime(),
        });
        await new_utils.increseCount(
            PRI_KEY,
            opposite_id,
            USER_SORT_KEY,
            opposite_id,
            'likes_gained',
            count
        );
        if (result.data && result.data != null) {
            utils.sendResult(201, { status: true, data: result.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: result.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error, port: 400 }, res);
    }
}

async function getLikeGained(req, res) {
    const { opposite_id } = req.params;
    const user_id = req.body.userid;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            opposite_id,
            LIKE_SORT_KEY,
            user_id
        );
        if (getRes.data) {
            utils.sendResult(200, { status: true, data: getRes.data }, res);
        } else {
            utils.sendResult(404, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

module.exports = {
    createuser,
    forgotpass,
    confirmCodePass,
    getallusers,
    findUser,
    deleteUser,
    health,
    healthNotification,
    updateuser,
    updateuserwithid,
    updateuserpass,
    login,
    getuser,
    connectUserid,
    delConnectUserid,
    createUserWithVCode,
    createUserFromAdmin,
    getConnectByUserId,
    getConnectsByUserId,
    getUsersByOpoositeId,
    adminlogin,
    adminsignup,
    verifyEmail,
    createLikeGained,
    getLikeGained,
};
