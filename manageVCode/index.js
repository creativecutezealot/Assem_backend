/// Routing assemble management
const R = require('ramda');
const phoneToken = require('generate-sms-verification-code');
const uidGenerator = require('node-unique-id-generator');
const express = require('express');
const assert = require('assert');
const crypto = require('crypto');
const dbClient = require('../utils/dbClient');
const utils = require('../utils/utils');
const models = require('../model/index');
const emailManager = require('../utils/email');
const smsManager = require('../utils/sms');
const userManager = require('../manageUser');

const VCODETABLENAME = 'VCode';
const VCODEECODEINDEXNAME = 'ecode-index';
const VCODEPCODEINDEXNAME = 'pcode-index';
const { TBLNAME } = process.env;
const USEREMAILINDEXNAME = 'email-index';

async function getVCodes(req, res) {
    const param = {
        TableName: VCODETABLENAME,
    };
    try {
        const result = await dbClient.scanItems(param);
        utils.sendResult(200, { status: true, data: result.Items }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function createVCode(req, res) {
    try {
        req.assert('phone', 'Phone cannot be blank').notEmpty();
        const errors = req.validationErrors();
        if (errors) {
            utils.sendResult(400, { status: false, data: errors[0].msg }, res);
            return;
        }
        const pcode = phoneToken(6, { type: 'number' });
        const ecode = uidGenerator.generateGUID();
        const phone = req.body.phone.replace('+', '').replace(/\s/g, '').trim();
        const createPayload = {
            phone: `${phone}`,
            ecode: `${ecode}`,
            pcode: `${pcode}`,
            table_name: 'VCODE',
        };
        const createModel = utils.generateInitDataModel(
            createPayload,
            models.vcode
        );
        createModel.expireIn = new Date().getTime() + 3600 * 24 * 7;
        const createparams = {
            TableName: VCODETABLENAME,
            Item: createModel,
        };
        const resultCreate = await dbClient.putItem(createparams);
        const msg = `${pcode} is your verification code for Assembly. Weclome to Assembly!`;
        await smsManager.sendSMS(req.body.phone, msg);
        // var emailOption = {
        //     to: [req.body.email],
        //     from: 'info@assembly.us',
        //     subject: 'Weclome to Assembly!',
        //     text: `Weclome to Assembly!`,
        //     html: msg
        // };
        // await emailManager.sendEmail(emailOption);
        utils.sendResult(201, { status: true, data: createModel }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function updateVCode(req, res) {
    try {
        req.assert('email', 'Email is not valid').isEmail();
        req.assert('email', 'Email cannot be blank').notEmpty();
        req.sanitize('email').normalizeEmail({ gmail_remove_dots: false });
        const errors = req.validationErrors();
        if (errors) {
            utils.sendResult(400, { status: false, data: errors[0].msg }, res);
            return;
        }
        const phone = req.params.phone
            .replace('+', '')
            .replace(/\s/g, '')
            .trim();
        const findPCodeParams = {
            TableName: VCODETABLENAME,
            KeyConditionExpression: 'phone =:phone',
            ExpressionAttributeValues: {
                ':phone': `${phone}`,
            },
        };
        const resFind = await userManager.findUser(req.body.email);
        if (resFind.Count > 0) {
            const user = resFind.Items[0];
            // if (user.approved) {
            //     utils.sendResult(200, { 'status': false, 'data': 'Hmm, Your email already registered. Please login.' }, res);
            // } else {
            //     utils.sendResult(201, { 'status': true, 'data': user }, res);
            // }
            utils.sendResult(201, { status: true, data: user }, res);
            return;
        }
        const resultPFind = await dbClient.getItems(findPCodeParams);
        if (resultPFind.Count > 0) {
            const { expression, arttributeValues } =
                utils.generateUpdateDataModel(
                    { email: req.body.email },
                    models.vcode
                );
            console.log(expression);
            const updateParam = {
                TableName: VCODETABLENAME,
                Key: {
                    phone: `${phone}`,
                },
                UpdateExpression: expression,
                ExpressionAttributeValues: arttributeValues,
                ReturnValues: 'ALL_NEW',
            };
            const result = await dbClient.updateItem(updateParam);
            const { ecode } = resultPFind.Items[0];
            const host = req.get('host');
            const verifylink = `${req.protocol}://${process.env.ADMIN_HOST}/#/verify/${ecode}`;
            const html = `You are receiving this because you (or someone else) have requested the verification for your email.\n\n
            Please click on the following link, or paste this into your browser to complete the process:<br></br>
            ${verifylink}<br></br>
            If you did not request this, please ignore this email.<br></br>`;
            const emailOption = {
                to: [req.body.email],
                from: 'rschuetzle@cleanmobility.com',
                subject: 'Assembly email verification',
                text: 'Assembly email verification',
                html,
            };
            await userManager.createUserWithVCode(
                req.body.email,
                req.params.phone,
                '',
                res
            );
            await emailManager.sendEmail(emailOption);
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
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function deleteVCode(req, res) {
    try {
        const { phone } = req.params;
        const deleteparams = {
            TableName: VCODETABLENAME,
            Key: {
                phone,
            },
        };
        const result = await dbClient.deleteItem(deleteparams);
        utils.sendResult(200, { status: true }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function getVCode(req, res) {
    const { code } = req.params;
    try {
        const findPCodeParams = {
            TableName: VCODETABLENAME,
            IndexName: VCODEPCODEINDEXNAME,
            KeyConditionExpression: 'pcode =:pcode',
            ExpressionAttributeValues: {
                ':pcode': code,
            },
        };
        const resultPFind = await dbClient.getItems(findPCodeParams);
        console.log('resultPFind: ', resultPFind);
        if (resultPFind.Count > 0) {
            utils.sendResult(200, { status: true }, res);
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
        console.log(error);
        utils.sendResult(
            400,
            {
                status: false,
                data: 'Hmm, that’s not the right code. Please try again.',
            },
            res
        );
    }
}

async function confirmCode(req, res) {
    const { ecode } = req.params;
    try {
        const findECodeParams = {
            TableName: VCODETABLENAME,
            IndexName: VCODEECODEINDEXNAME,
            KeyConditionExpression: 'ecode =:ecode',
            ExpressionAttributeValues: {
                ':ecode': ecode,
            },
        };
        const resultEFind = await dbClient.getItems(findECodeParams);
        if (resultEFind.Count > 0) {
            userManager.verifyEmail(resultEFind.Items[0].email, res);
            utils.sendResult(200, { status: true }, res);
        } else {
            utils.sendResult(
                404,
                { status: true, data: 'donot exist code' },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

async function sendEmailCode(req, res) {
    const { email } = req.body;
    try {
        await smsManager.sendEmailCode(email, (sendResult) => {
            console.log(sendResult);
            if (sendResult && sendResult.status === 'pending') {
                utils.sendResult(201, { status: true, data: sendResult }, res);
            } else {
                utils.sendResult(201, { status: true, data: null }, res);
            }
        });
    } catch (error) {
        utils.sendResult(201, { status: false, data: error }, res);
    }
}

async function checkEmailCode(req, res) {
    const { email } = req.body;
    const { code } = req.body;
    try {
        await smsManager.checkEmailCode(email, code, (checkResult) => {
            console.log(checkResult);
            if (checkResult.status && checkResult.status === 'approved') {
                utils.sendResult(201, { status: true, data: checkResult }, res);
            } else {
                utils.sendResult(400, { status: false, data: null }, res);
            }
        });
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function inviteCodeRequest(req, res) {
    const { email, name } = req.body;
    const date = new Date();
    try {
        const htmlString = `User name: ${name} <br/><br/> Email: ${email} <br/><br/> Date: ${date}`;
        const emailOption = {
            to: [email],
            from: 'info@assembly.us',
            subject: 'Invite Code Request',
            text: 'Assembly Audio Submitted',
            html: `${htmlString}`,
        };
        console.log('emailOption: ', emailOption);
        const response = await emailManager.sendEmail(emailOption);
        if (response) {
            utils.sendResult(201, { status: true, data: emailOption }, res);
        } else {
            utils.sendResult(500, { status: false, data: 'Internal Server Error' }, res);
        }
    } catch (error) {
        console.log('inviteCodeRequest Error: ', error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

module.exports = {
    createVCode,
    getVCode,
    getVCodes,
    confirmCode,
    updateVCode,
    deleteVCode,
    sendEmailCode,
    checkEmailCode,
    inviteCodeRequest
};
