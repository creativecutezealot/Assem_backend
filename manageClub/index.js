/// Routing club management
const R = require('ramda');
const phoneToken = require('generate-sms-verification-code');
const uidGenerator = require('node-unique-id-generator');
const express = require('express');
const assert = require('assert');
const crypto = require('crypto');
const { model } = require('mongoose');
const dbClient = require('../utils/dbClient');
const utils = require('../utils/utils');
const new_utils = require('../utils/new_utils');
const models = require('../model/index');
const smsManager = require('../utils/sms');
const emailManager = require('../utils/email');
const manager = require('../services');

const { TBLNAME } = process.env;
const PRI_KEY = 'CLUB';
const USER_PRI_KEY = 'USER';
const REQUEST_KEY = 'CLUBREQUEST';
const ROOMIMAGES_KEY = 'ROOMIMAGES';
const MANAGER_KEY = 'AMANAGER';
const AUDIO_KEY = 'AUDIO';
const CLUB_SORT_KEY = 'METADATA';
const CONNECT_SORT_KEY = 'CONNECT';
const RECORD_SORT_KEY = 'RECORD';
const TABLEINDEXNAME = 'table_name-index';
const INVERTEDINDEXNAME = 'inverted-index';
const ENTER_CLUB_ID_INDEXNAME = 'enter_club_id-index';

async function getclubs(req, res) {
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
        utils.sendResult(200, { status: true, data: resultFind.Items }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function getAllClubs(req, res) {
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
        const clubs = [];
        if (resultFind.Items && resultFind.Items.length > 0) {
            for (const club of resultFind.Items) {
                const { club_id } = club;
                const queryRes = await new_utils.queryData(
                    PRI_KEY,
                    club_id,
                    USER_PRI_KEY
                );
                if (queryRes.data) {
                    /// After queried, we need to get data with userIds
                    let users = [];
                    if (queryRes.data && queryRes.data.length > 0) {
                        const batchRes = await new_utils.batchConnectGetData(
                            USER_PRI_KEY,
                            CLUB_SORT_KEY,
                            queryRes.data,
                            false
                        );
                        users = batchRes.data;
                    }
                    users = users.filter((a) => a.user_id);
                    club.members = (users || []).length;
                }
                clubs.push(club);
            }
        }
        utils.sendResult(200, { status: true, data: clubs }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function createclub(req, res) {
    try {
        const clubid = uidGenerator.generateGUID();
        // const access_code = 12345;//phoneToken(5, { type: 'number' });
        const createPayload = {
            ...req.body,
            club_id: clubid,
            user_id: req.body.userid,
            table_name: PRI_KEY,
            // 'access_code': `${access_code}`,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            clubid,
            CLUB_SORT_KEY,
            clubid,
            createPayload,
            models.club
        );

        /// create connect club with user Id
        const createConnectPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await new_utils.createData(
            PRI_KEY,
            clubid,
            USER_PRI_KEY,
            req.body.userid,
            createConnectPayload,
            models.club_connect
        );
        /// Update members count
        await new_utils.increseCount(
            PRI_KEY,
            clubid,
            CLUB_SORT_KEY,
            clubid,
            'members'
        );
        if (createRes.data) {
            utils.sendResult(
                201,
                { status: true, data: createRes.data, port: 201 },
                res
            );
        } else {
            utils.sendResult(
                400,
                { status: false, data: createRes.error, port: 400 },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error, port: 400 }, res);
    }
}

async function updateclub(req, res) {
    try {
        const { club_id } = req.params;
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            club_id,
            CLUB_SORT_KEY,
            club_id,
            req.body,
            models.club
        );
        if (updateRes.data) {
            delete updateRes.data.members;
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

async function deleteclub(req, res) {
    const { club_id } = req.params;
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            club_id,
            CLUB_SORT_KEY,
            club_id
        );
        if (delRes.data) {
            cleanClubConnect(club_id);
            cleanClubRequest(club_id);
            cleanClubList(club_id);
            cleanClubManger(club_id);
            utils.sendResult(200, { status: true, data: delRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: delRes.error }, res);
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function deleteItems(delData) {
    const promise_ = [];
    if (delData.data && delData.data.length > 0) {
        for (const data of delData.data) {
            const delParam = {
                TableName: TBLNAME,
                Key: {
                    pri_key: data.pri_key,
                    sort_key: data.sort_key,
                },
            };
            promise_.push(dbClient.deleteItem(delParam));
        }
        await Promise.all(promise_);
    }
}

async function cleanClubConnect(club_id) {
    const queryRes = await new_utils.queryData(PRI_KEY, club_id, USER_PRI_KEY);
    deleteItems(queryRes);
}

async function cleanClubRequest(club_id) {
    const queryRes = await new_utils.queryData(PRI_KEY, club_id, REQUEST_KEY);
    deleteItems(queryRes);
}

async function cleanClubManger(club_id) {
    const queryRes = await new_utils.queryData(PRI_KEY, club_id, MANAGER_KEY);
    deleteItems(queryRes);
    if (queryRes.data && queryRes.data.length > 0) {
        for (const connectItem of queryRes.data) {
            const splitSortKeys = connectItem.sort_key.split('#');
            if (splitSortKeys.length > 0) {
                const userId = splitSortKeys[splitSortKeys.length - 1];
                if (userId !== '') {
                    const user = await manager.getuser(userId);
                    if (user && user.user_role === 'manager') {
                        await new_utils.updateData(
                            USER_PRI_KEY,
                            userId,
                            CLUB_SORT_KEY,
                            userId,
                            {
                                user_role: 'user',
                            },
                            models.user
                        );
                    }
                }
            }
        }
    }
}

async function cleanClubList(club_id) {
    const findparams = {
        TableName: TBLNAME,
        IndexName: ENTER_CLUB_ID_INDEXNAME,
        KeyConditionExpression: 'enter_club_id = :enter_club_id',
        ExpressionAttributeValues: {
            ':enter_club_id': club_id,
        },
    };
    const resultFind = await dbClient.getItems(findparams);
    if (resultFind.Count > 0) {
        const lists = resultFind.Items;
        deleteItems({ data: lists });
    }
}

async function getclub(req, res) {
    const { club_id } = req.params;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            club_id,
            CLUB_SORT_KEY,
            club_id
        );
        if (getRes.data) {
            console.log('this is the data');
            console.log(getRes.data);
            const user = await manager.getuser(getRes.data.user_id);
            const data = {
                user,
                club: getRes.data,
            };
            utils.sendResult(201, { status: true, data }, res);
        } else {
            utils.sendResult(400, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

// request userid in connect
async function getClubRequest(req, res) {
    try {
        try {
            const findparams = {
                TableName: TBLNAME,
                IndexName: TABLEINDEXNAME,
                KeyConditionExpression: 'table_name = :table_name',
                ExpressionAttributeValues: {
                    ':table_name': REQUEST_KEY,
                },
            };
            const resultFind = await dbClient.getItems(findparams);
            utils.sendResult(
                200,
                { status: true, data: resultFind.Items },
                res
            );
        } catch (error) {
            utils.sendResult(404, { status: false, data: error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

// request userid in connect
async function getClubRequestByClubId(req, res) {
    try {
        try {
            const { club_id } = req.params;
            const queryRes = await new_utils.queryData(
                PRI_KEY,
                club_id,
                REQUEST_KEY
            );
            if (queryRes.data) {
                utils.sendResult(
                    200,
                    { status: true, data: queryRes.data },
                    res
                );
            } else {
                utils.sendResult(
                    400,
                    { status: false, data: queryRes.error },
                    res
                );
            }
        } catch (error) {
            utils.sendResult(404, { status: false, data: error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

async function requestClub(req, res) {
    try {
        const { club_id } = req.body;
        const clubRes = await new_utils.getData(
            PRI_KEY,
            club_id,
            CLUB_SORT_KEY,
            club_id
        );
        if (!clubRes.data) {
            utils.sendResult(404, { status: false, data: 'no data' }, res);
            return;
        }
        const club = clubRes.data;
        const { userid } = req.body;
        const user = await manager.getuser(userid);
        if (!user) {
            utils.sendResult(404, { status: false, data: 'no data' }, res);
            return;
        }
        const is_approved = req.body.is_approved || false;
        const createPayload = {
            ...club,
            ...normalizedUser(user),
            table_name: REQUEST_KEY,
            is_approved,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            club_id,
            REQUEST_KEY,
            userid,
            createPayload,
            models.club_request
        );

        console.log('createRes data: ', createRes);

        if (createRes.data) {
            utils.sendResult(201, { status: true, data: createRes.data }, res);
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

// request userid in connect
async function approveClubRequest(req, res) {
    try {
        const { club_id } = req.body;
        const userid = req.body.user_id;
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            club_id,
            REQUEST_KEY,
            userid,
            req.body,
            models.club_request
        );
        const user = await manager.getuser(userid);
        if (updateRes.data) {
            const { is_approved } = updateRes.data;
            const { phone_number } = user;
            const { email } = user;
            if (is_approved && email !== '') {
                const { access_code } = updateRes.data;
                const { club_name } = updateRes.data;
                const msg = `Your request to join '${club_name}' has been approved. Your access code is ${access_code}`;
                const emailOption = {
                    to: [email],
                    from: 'info@assembly.us',
                    subject: 'Assembly Request Invite Code',
                    text: 'Assembly Request Invite Code',
                    html: msg,
                };
                await emailManager.sendEmail(emailOption);
            }
            utils.sendResult(201, { status: true, data: updateRes.data }, res);
        } else {
            utils.sendResult(
                400,
                { status: false, data: updateRes.error },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

async function deleteClubRequest(req, res) {
    try {
        const { club_id } = req.params;
        const userid = req.params.user_id;
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            club_id,
            REQUEST_KEY,
            userid
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
// add userid in connect
async function connectUserid(req, res) {
    try {
        const { club_id } = req.body;
        const { userid } = req.body;
        const createPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            club_id,
            USER_PRI_KEY,
            userid,
            createPayload,
            models.club_connect
        );
        if (createRes.data) {
            await new_utils.increseCount(
                PRI_KEY,
                club_id,
                CLUB_SORT_KEY,
                club_id,
                'members'
            );
            utils.sendResult(201, { status: true, data: createRes.data }, res);
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

async function deleteConnectUserid(req, res) {
    const { club_id } = req.params;
    const { userid } = req.params;
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            club_id,
            USER_PRI_KEY,
            userid
        );
        if (delRes.data) {
            await new_utils.increseCount(
                PRI_KEY,
                club_id,
                CLUB_SORT_KEY,
                club_id,
                'members',
                -1
            );
            utils.sendResult(201, { status: true, data: delRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: delRes.error }, res);
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function deleteConnectUserAdmin(req, res) {
    const { club_id } = req.params;
    const { user_id } = req.params;
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            club_id,
            USER_PRI_KEY,
            user_id
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

// get connected users by club_id
async function getUsersByClubId(req, res) {
    try {
        const { club_id } = req.params;
        const queryRes = await new_utils.queryData(
            PRI_KEY,
            club_id,
            USER_PRI_KEY
        );
        if (queryRes.data) {
            /// After queried, we need to get data with userIds
            const club = await new_utils.getData(
                PRI_KEY,
                club_id,
                CLUB_SORT_KEY,
                club_id
            );
            let users = [];
            if (queryRes.data && queryRes.data.length > 0) {
                const batchRes = await new_utils.batchConnectGetData(
                    USER_PRI_KEY,
                    CLUB_SORT_KEY,
                    queryRes.data,
                    false
                );
                users = batchRes.data;
            }
            users = users.filter((a) => a.user_id);
            utils.sendResult(
                201,
                { status: true, data: club.data, connect: users },
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
async function getClubsByUserId(req, res) {
    try {
        const user_id =
            req.params.user_id == null ? req.body.userid : req.params.user_id;
        const queryRes = await new_utils.queryInvertData(
            PRI_KEY,
            USER_PRI_KEY,
            user_id
        );
        if (queryRes.data) {
            const user = await new_utils.getData(
                USER_PRI_KEY,
                user_id,
                CLUB_SORT_KEY,
                user_id
            );
            let clubs = [];
            if (queryRes.data && queryRes.data.length > 0) {
                const batchRes = await new_utils.batchConnectGetData(
                    PRI_KEY,
                    CLUB_SORT_KEY,
                    queryRes.data,
                    true
                );
                clubs = batchRes.data;
            }
            for (const index in queryRes.data) {
                const connectItem = queryRes.data[index];
                const club_index = clubs.findIndex(
                    (c) =>
                        c.club_id === connectItem.pri_key.replace('CLUB#', '')
                );
                if (club_index !== -1) {
                    clubs[club_index].updated_at = connectItem.updated_at;
                    clubs[club_index].connected_at = connectItem.created_at;
                }
            }
            utils.sendResult(
                200,
                { status: true, data: user.data, connect: clubs },
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

async function createclub_recorder(req, res) {
    try {
        const { club_id } = req.body;
        const { userid } = req.body;
        const createPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            club_id,
            RECORD_SORT_KEY,
            userid,
            createPayload,
            models.club_connect
        );
        if (createRes.data && createRes.data != null) {
            utils.sendResult(201, { status: true, data: createRes.data }, res);
        } else {
            utils.sendResult(
                400,
                { status: false, data: createRes.error },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error, port: 400 }, res);
    }
}

async function getclub_recorder(req, res) {
    const { club_id } = req.params;
    const user_id = req.body.userid;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            club_id,
            RECORD_SORT_KEY,
            user_id
        );
        if (getRes.data) {
            console.log(getRes.data);
            utils.sendResult(200, { status: true, data: getRes.data }, res);
        } else {
            utils.sendResult(404, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

async function getListByClubId(req, res) {
    try {
        const { club_id } = req.params;
        const findparams = {
            TableName: TBLNAME,
            IndexName: ENTER_CLUB_ID_INDEXNAME,
            KeyConditionExpression: 'enter_club_id = :enter_club_id',
            ExpressionAttributeValues: {
                ':enter_club_id': club_id,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        if (resultFind.Count > 0) {
            let assembles = resultFind.Items.filter(item => item.table_name != 'VOICENOTE');
            utils.sendResult(200, { status: true, data: assembles }, res);
        } else {
            utils.sendResult(200, { status: true, data: [] }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

const normalizedUser = (user) => {
    delete user.api_token;
    delete user.password;
    delete user.sort_key;
    delete user.pri_key;
    return user;
};

/// add club manager
// add userid in connect
async function addClubManager(req, res) {
    try {
        const { club_id } = req.body;
        const userid = req.body.user_id;
        const { user_role } = req.body;
        if (user_role === 'manager') {
            const createPayload = {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const createRes = await new_utils.createData(
                PRI_KEY,
                club_id,
                MANAGER_KEY,
                userid,
                createPayload,
                models.club_connect
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
        } else {
            const delRes = await new_utils.deleteData(
                PRI_KEY,
                club_id,
                MANAGER_KEY,
                userid
            );
            if (delRes.data) {
                utils.sendResult(201, { status: true, data: delRes.data }, res);
            } else {
                utils.sendResult(
                    400,
                    { status: false, data: delRes.error },
                    res
                );
            }
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

/// / get clubs by connect userId
async function getClubsByManagerId(req, res) {
    try {
        const user_id =
            req.params.user_id == null ? req.body.userid : req.params.user_id;
        const queryRes = await new_utils.queryInvertData(
            PRI_KEY,
            MANAGER_KEY,
            user_id
        );
        if (queryRes.data) {
            let clubs = [];
            if (queryRes.data && queryRes.data.length > 0) {
                const batchRes = await new_utils.batchConnectGetData(
                    PRI_KEY,
                    CLUB_SORT_KEY,
                    queryRes.data,
                    true
                );
                clubs = batchRes.data;
            }
            utils.sendResult(200, { status: true, data: clubs }, res);
        } else {
            utils.sendResult(400, { status: false, data: queryRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

// get connected users by club_id
async function getManagersByClubId(req, res) {
    try {
        const { club_id } = req.params;
        const queryRes = await new_utils.queryData(
            PRI_KEY,
            club_id,
            MANAGER_KEY
        );
        if (queryRes.data) {
            utils.sendResult(200, { status: true, data: queryRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: queryRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(404, { status: false, data: 'no data' }, res);
    }
}

async function createClubRoomImage(req, res) {
    try {
        const { club_id } = req.body;
        const image_id = uidGenerator.generateGUID();
        const { photo_url } = req.body; // hh:mm:ss
        const createPayload = {
            photo_url,
            club_id,
            table_name: ROOMIMAGES_KEY,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const result = await new_utils.createData(
            ROOMIMAGES_KEY,
            club_id,
            CLUB_SORT_KEY,
            image_id,
            createPayload,
            models.club_images
        );
        utils.sendResult(201, { status: true, data: result.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function deleteClubRoomImage(req, res) {
    try {
        const { club_id } = req.params;
        const { image_id } = req.params;
        const result = await new_utils.deleteData(
            ROOMIMAGES_KEY,
            club_id,
            CLUB_SORT_KEY,
            image_id
        );
        utils.sendResult(200, { status: true, data: result.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function getClubRoomImages(req, res) {
    try {
        const { club_id } = req.params;
        const queryImagesRes = await new_utils.queryData(
            ROOMIMAGES_KEY,
            club_id,
            CLUB_SORT_KEY
        );
        utils.sendResult(200, { status: true, data: queryImagesRes.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function getAllClubTiers(req, res) {}

async function createClubTier(req, res) {
    try {
        const clubid = uidGenerator.generateGUID();
        // const access_code = 12345;//phoneToken(5, { type: 'number' });
        const createPayload = {
            ...req.body,
            club_id: clubid,
            user_id: req.body.userid,
            table_name: PRI_KEY,
            // 'access_code': `${access_code}`,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            clubid,
            CLUB_SORT_KEY,
            clubid,
            createPayload,
            models.club
        );

        /// create connect club with user Id
        const createConnectPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await new_utils.createData(
            PRI_KEY,
            clubid,
            USER_PRI_KEY,
            req.body.userid,
            createConnectPayload,
            models.club_connect
        );
        /// Update members count
        await new_utils.increseCount(
            PRI_KEY,
            clubid,
            CLUB_SORT_KEY,
            clubid,
            'members'
        );
        if (createRes.data) {
            utils.sendResult(
                201,
                { status: true, data: createRes.data, port: 201 },
                res
            );
        } else {
            utils.sendResult(
                400,
                { status: false, data: createRes.error, port: 400 },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error, port: 400 }, res);
    }
}

async function updateClubTier(req, res) {}

async function deleteClubTier(req, res) {}

module.exports = {
    getclubs,
    getAllClubs,
    createclub,
    updateclub,
    deleteclub,
    getclub,
    connectUserid,
    deleteConnectUserid,
    deleteConnectUserAdmin,
    getUsersByClubId,
    getClubsByUserId,
    createclub_recorder,
    getclub_recorder,
    getListByClubId,
    requestClub,
    getClubRequest,
    getClubRequestByClubId,
    approveClubRequest,
    deleteClubRequest,
    addClubManager,
    getClubsByManagerId,
    getManagersByClubId,
    createClubRoomImage,
    deleteClubRoomImage,
    getClubRoomImages,
    getAllClubTiers,
    createClubTier,
    updateClubTier,
    deleteClubTier,
};
