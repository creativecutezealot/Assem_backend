/// Routing group management
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
const manager = require('../services');

const { TBLNAME } = process.env;
const PRI_KEY = 'GROUP';
const USER_PRI_KEY = 'USER';
const REQUEST_KEY = 'GROUPREQUEST';
const ROOMIMAGES_KEY = 'ROOMIMAGES';
const MANAGER_KEY = 'AMANAGER';
const AUDIO_KEY = 'AUDIO';
const GROUP_SORT_KEY = 'METADATA';
const CONNECT_SORT_KEY = 'CONNECT';
const RECORD_SORT_KEY = 'RECORD';
const TABLEINDEXNAME = 'table_name-index';
const INVERTEDINDEXNAME = 'inverted-index';
const ENTER_GROUP_ID_INDEXNAME = 'enter_group_id-index';

async function getgroups(req, res) {
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

async function getAllGroups(req, res) {
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
        const groups = [];
        if (resultFind.Items && resultFind.Items.length > 0) {
            for (const group of resultFind.Items) {
                const { group_id } = group;
                const queryRes = await new_utils.queryData(
                    PRI_KEY,
                    group_id,
                    USER_PRI_KEY
                );
                if (queryRes.data) {
                    /// After queried, we need to get data with userIds
                    let users = [];
                    if (queryRes.data && queryRes.data.length > 0) {
                        const batchRes = await new_utils.batchConnectGetData(
                            USER_PRI_KEY,
                            GROUP_SORT_KEY,
                            queryRes.data,
                            false
                        );
                        users = batchRes.data;
                    }
                    users = users.filter((a) => a.user_id);
                    group.members = (users || []).length;
                }
                groups.push(group);
            }
        }
        utils.sendResult(200, { status: true, data: groups }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function creategroup(req, res) {
    try {
        const groupid = uidGenerator.generateGUID();
        // const access_code = 12345;//phoneToken(5, { type: 'number' });
        const createPayload = {
            ...req.body,
            group_id: groupid,
            user_id: req.body.userid,
            table_name: PRI_KEY,
            // 'access_code': `${access_code}`,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            groupid,
            GROUP_SORT_KEY,
            groupid,
            createPayload,
            models.group
        );

        /// create connect group with user Id
        const createConnectPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await new_utils.createData(
            PRI_KEY,
            groupid,
            USER_PRI_KEY,
            req.body.userid,
            createConnectPayload,
            models.group_connect
        );
        /// Update members count
        await new_utils.increseCount(
            PRI_KEY,
            groupid,
            GROUP_SORT_KEY,
            groupid,
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

async function updategroup(req, res) {
    try {
        const { group_id } = req.params;
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            group_id,
            GROUP_SORT_KEY,
            group_id,
            req.body,
            models.group
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

async function deletegroup(req, res) {
    const { group_id } = req.params;
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            group_id,
            GROUP_SORT_KEY,
            group_id
        );
        if (delRes.data) {
            cleangroupConnect(group_id);
            cleangroupRequest(group_id);
            cleangroupList(group_id);
            cleangroupManger(group_id);
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

async function cleangroupConnect(group_id) {
    const queryRes = await new_utils.queryData(PRI_KEY, group_id, USER_PRI_KEY);
    deleteItems(queryRes);
}

async function cleangroupRequest(group_id) {
    const queryRes = await new_utils.queryData(PRI_KEY, group_id, REQUEST_KEY);
    deleteItems(queryRes);
}

async function cleangroupManger(group_id) {
    const queryRes = await new_utils.queryData(PRI_KEY, group_id, MANAGER_KEY);
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
                            GROUP_SORT_KEY,
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

async function cleangroupList(group_id) {
    const findparams = {
        TableName: TBLNAME,
        // IndexName: ENTER_group_ID_INDEXNAME,
        KeyConditionExpression: 'enter_group_id = :enter_group_id',
        ExpressionAttributeValues: {
            ':enter_group_id': group_id,
        },
    };
    const resultFind = await dbClient.getItems(findparams);
    if (resultFind.Count > 0) {
        const lists = resultFind.Items;
        deleteItems({ data: lists });
    }
}

async function getgroup(req, res) {
    const { group_id } = req.params;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            group_id,
            GROUP_SORT_KEY,
            group_id
        );
        if (getRes.data) {
            console.log('this is the data');
            console.log(getRes.data);
            const user = await manager.getuser(getRes.data.user_id);
            const data = {
                user,
                group: getRes.data,
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
async function getgroupRequest(req, res) {
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
async function getgroupRequestBygroupId(req, res) {
    try {
        try {
            const { group_id } = req.params;
            const queryRes = await new_utils.queryData(
                PRI_KEY,
                group_id,
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

async function requestgroup(req, res) {
    try {
        const { group_id } = req.body;
        const groupRes = await new_utils.getData(
            PRI_KEY,
            group_id,
            GROUP_SORT_KEY,
            group_id
        );
        if (!groupRes.data) {
            utils.sendResult(404, { status: false, data: 'no data' }, res);
            return;
        }
        const group = groupRes.data;
        const { userid } = req.body;
        const user = await manager.getuser(userid);
        if (!user) {
            utils.sendResult(404, { status: false, data: 'no data' }, res);
            return;
        }
        const is_approved = req.body.is_approved || false;
        const createPayload = {
            ...group,
            ...normalizedUser(user),
            table_name: REQUEST_KEY,
            is_approved,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            group_id,
            REQUEST_KEY,
            userid,
            createPayload,
            models.group_request
        );
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
async function approvegroupRequest(req, res) {
    try {
        const { group_id } = req.body;
        const userid = req.body.user_id;
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            group_id,
            REQUEST_KEY,
            userid,
            req.body,
            models.group_request
        );
        const user = await manager.getuser(userid);
        if (updateRes.data) {
            const { is_approved } = updateRes.data;
            const { phone_number } = user;
            if (is_approved && phone_number != '') {
                const { access_code } = updateRes.data;
                const { group_name } = updateRes.data;
                const msg = `Your request to join '${group_name}' has been approved. Your access code is ${access_code}`;
                await smsManager.sendSMS(phone_number, msg);
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

async function deletegroupRequest(req, res) {
    try {
        const { group_id } = req.params;
        const userid = req.params.user_id;
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            group_id,
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
        const { group_id } = req.body;
        const { userid } = req.body;
        const createPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            group_id,
            USER_PRI_KEY,
            userid,
            createPayload,
            models.group_connect
        );
        if (createRes.data) {
            await new_utils.increseCount(
                PRI_KEY,
                group_id,
                GROUP_SORT_KEY,
                group_id,
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
    const { group_id } = req.params;
    const { userid } = req.body;
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            group_id,
            USER_PRI_KEY,
            userid
        );
        if (delRes.data) {
            await new_utils.increseCount(
                PRI_KEY,
                group_id,
                GROUP_SORT_KEY,
                group_id,
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
    const { group_id } = req.params;
    const { user_id } = req.params;
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            group_id,
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

// get connected users by group_id
async function getUsersByGroupId(req, res) {
    try {
        const { group_id } = req.params;
        const queryRes = await new_utils.queryData(
            PRI_KEY,
            group_id,
            USER_PRI_KEY
        );
        if (queryRes.data) {
            /// After queried, we need to get data with userIds
            const group = await new_utils.getData(
                PRI_KEY,
                group_id,
                GROUP_SORT_KEY,
                group_id
            );
            let users = [];
            if (queryRes.data && queryRes.data.length > 0) {
                const batchRes = await new_utils.batchConnectGetData(
                    USER_PRI_KEY,
                    GROUP_SORT_KEY,
                    queryRes.data,
                    false
                );
                users = batchRes.data;
            }
            users = users.filter((a) => a.user_id);
            utils.sendResult(
                201,
                { status: true, data: group.data, connect: users },
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
async function getGroupsByUserId(req, res) {
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
                GROUP_SORT_KEY,
                user_id
            );
            let groups = [];
            if (queryRes.data && queryRes.data.length > 0) {
                const batchRes = await new_utils.batchConnectGetData(
                    PRI_KEY,
                    GROUP_SORT_KEY,
                    queryRes.data,
                    true
                );
                groups = batchRes.data;
            }
            for (const index in queryRes.data) {
                const connectItem = queryRes.data[index];
                const group_index = groups.findIndex(
                    (c) =>
                        c.group_id === connectItem.pri_key.replace('group#', '')
                );
                if (group_index !== -1) {
                    groups[group_index].updated_at = connectItem.updated_at;
                    groups[group_index].connected_at = connectItem.created_at;
                }
            }
            utils.sendResult(
                200,
                { status: true, data: user.data, connect: groups },
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

async function creategroup_recorder(req, res) {
    try {
        const { group_id } = req.body;
        const { userid } = req.body;
        const createPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            group_id,
            RECORD_SORT_KEY,
            userid,
            createPayload,
            models.group_connect
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

async function getgroup_recorder(req, res) {
    const { group_id } = req.params;
    const user_id = req.body.userid;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            group_id,
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

async function getListByGroupId(req, res) {
    try {
        const { group_id } = req.params;
        const decludeVoice = String(req.query.decludeVoice) === 'true';
        const findparams = {
            TableName: TBLNAME,
            // IndexName: ENTER_group_ID_INDEXNAME,
            KeyConditionExpression: 'enter_group_id = :enter_group_id',
            ExpressionAttributeValues: {
                ':enter_group_id': group_id,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        if (resultFind.Count > 0) {
            let assembles = resultFind.Items;
            let users = [];
            const usersRes = await new_utils.batchUserGetData(assembles);
            if (usersRes.data && usersRes.data.length > 0) {
                users = usersRes.data;
            }
            assembles = assembles.map((assemble) => {
                const userIdx = users.findIndex(
                    (r) => r.user_id === assemble.user_id
                );
                if (userIdx != -1) {
                    const user = users[userIdx];
                    assemble.user = normalizedUser(user);
                } else {
                    assemble.user = {};
                }
                return assemble;
            });
            assembles = assembles.filter((r) => !r.is_ended);
            if (decludeVoice) {
                assembles = assembles.filter((r) => !r.voicenote_id);
            } else {
                for (let i = 0; i < assembles.length; i++) {
                    const item = assembles[i];
                    /// voice note
                    if (
                        item.voicenote_id &&
                        item.voicenote_id !== '' &&
                        item.hello_audio_id !== ''
                    ) {
                        const audioGetRes = await new_utils.getData(
                            AUDIO_KEY,
                            item.hello_audio_id,
                            GROUP_SORT_KEY,
                            item.hello_audio_id
                        );
                        if (audioGetRes.data) {
                            assembles[i].audio_obj = audioGetRes.data;
                        }
                    }
                }
            }
            let pinnedData = assembles.filter((a) => a.is_pinned);
            pinnedData = pinnedData.sort(
                (a, b) =>
                    new Date(b.pinned_at).getTime() -
                    new Date(a.pinned_at).getTime()
            );
            let unPinnedData = assembles.filter((a) => !a.is_pinned);
            unPinnedData = unPinnedData.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
            );
            assembles = [...pinnedData, ...unPinnedData];
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

/// add group manager
// add userid in connect
async function addGroupManager(req, res) {
    try {
        const { group_id } = req.body;
        const userid = req.body.user_id;
        const { user_role } = req.body;
        if (user_role === 'manager') {
            const createPayload = {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const createRes = await new_utils.createData(
                PRI_KEY,
                group_id,
                MANAGER_KEY,
                userid,
                createPayload,
                models.group_connect
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
                group_id,
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

/// / get users by connect userId
async function getGroupsByManagerId(req, res) {
    try {
        const user_id =
            req.params.user_id == null ? req.body.userid : req.params.user_id;
        const queryRes = await new_utils.queryInvertData(
            PRI_KEY,
            MANAGER_KEY,
            user_id
        );
        if (queryRes.data) {
            let groups = [];
            if (queryRes.data && queryRes.data.length > 0) {
                const batchRes = await new_utils.batchConnectGetData(
                    PRI_KEY,
                    GROUP_SORT_KEY,
                    queryRes.data,
                    true
                );
                groups = batchRes.data;
            }
            utils.sendResult(200, { status: true, data: groups }, res);
        } else {
            utils.sendResult(400, { status: false, data: queryRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

// get connected users by group_id
async function getManagersByGroupId(req, res) {
    try {
        const { group_id } = req.params;
        const queryRes = await new_utils.queryData(
            PRI_KEY,
            group_id,
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

async function creategroupRoomImage(req, res) {
    try {
        const { group_id } = req.body;
        const image_id = uidGenerator.generateGUID();
        const { photo_url } = req.body; // hh:mm:ss
        const createPayload = {
            photo_url,
            group_id,
            table_name: ROOMIMAGES_KEY,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const result = await new_utils.createData(
            ROOMIMAGES_KEY,
            group_id,
            GROUP_SORT_KEY,
            image_id,
            createPayload,
            models.group_images
        );
        utils.sendResult(201, { status: true, data: result.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function deletegroupRoomImage(req, res) {
    try {
        const { group_id } = req.params;
        const { image_id } = req.params;
        const result = await new_utils.deleteData(
            ROOMIMAGES_KEY,
            group_id,
            GROUP_SORT_KEY,
            image_id
        );
        utils.sendResult(200, { status: true, data: result.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function getgroupRoomImages(req, res) {
    try {
        const { group_id } = req.params;
        const queryImagesRes = await new_utils.queryData(
            ROOMIMAGES_KEY,
            group_id,
            GROUP_SORT_KEY
        );
        utils.sendResult(200, { status: true, data: queryImagesRes.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

module.exports = {
    getgroups,
    getAllGroups,
    creategroup,
    updategroup,
    deletegroup,
    getgroup,
    connectUserid,
    deleteConnectUserid,
    deleteConnectUserAdmin,
    getUsersByGroupId,
    getGroupsByUserId,
    creategroup_recorder,
    getgroup_recorder,
    getListByGroupId,
    requestgroup,
    getgroupRequest,
    getgroupRequestBygroupId,
    approvegroupRequest,
    deletegroupRequest,
    addGroupManager,
    getGroupsByManagerId,
    getManagersByGroupId,
    creategroupRoomImage,
    deletegroupRoomImage,
    getgroupRoomImages,
};
