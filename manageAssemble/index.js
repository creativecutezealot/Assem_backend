/// Routing assemble management
const R = require('ramda');
const phoneToken = require('generate-sms-verification-code');
const uidGenerator = require('node-unique-id-generator');
const express = require('express');
const assert = require('assert');
const crypto = require('crypto');
const moment = require('moment-timezone');
const dbClient = require('../utils/dbClient');
const utils = require('../utils/utils');
const sendMail = require('../utils/email');
const models = require('../model/index');
const new_utils = require('../utils/new_utils');
const mqttClient = require('../socket');
const notification = require('../utils/notificaion');
const manager = require('../services');

const { TBLNAME } = process.env;
const PRI_KEY = 'ASSEMBLEY';
const USER_PRI_KEY = 'USER';
const ASSEMBLY_SORT_KEY = 'METADATA';
const CONNECT_SORT_KEY = 'CONNECT';
const LIKE_SORT_KEY = 'LIKE';
const TABLEINDEXNAME = 'table_name-index';
const CLUB_PRI_KEY = 'CLUB';
const CLUB_SORT_KEY = 'METADATA';
const MQTT_INVITE_TOPIC = `presence/${process.env.MQTT_USERNAME}/invite/assembly`;
const MQTT_UPDATE_TOPIC = `presence/${process.env.MQTT_USERNAME}/update/assembly`;
const MQTT_DELETE_TOPIC = `presence/${process.env.MQTT_USERNAME}/delete/assembly`;
const MQTT_END_TOPIC = `presence/${process.env.MQTT_USERNAME}/end/assembly`;
const MQTT_REORDER_TOPIC = `presence/${process.env.MQTT_USERNAME}/reorder/assembly`;
const MQTT_LIKE_TOPIC = `presence/${process.env.MQTT_USERNAME}/like/user`;

const abbrs = {
    EST: 'Eastern Standard Time',
    EDT: 'Eastern Daylight Time',
    CST: 'Central Standard Time',
    CDT: 'Central Daylight Time',
    MST: 'Mountain Standard Time',
    MDT: 'Mountain Daylight Time',
    PST: 'Pacific Standard Time',
    PDT: 'Pacific Daylight Time',
};

async function getassembles(req, res) {
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
        const result = resultFind.Items;
        utils.sendResult(200, { status: true, data: resultFind.Items }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

const getFollowings = async (userid, club_id) => {
    let users = [];
    try {
        const queryRes = await new_utils.queryData(
            USER_PRI_KEY,
            `${userid}_${club_id}`,
            CONNECT_SORT_KEY
        );
        if (queryRes.data) {
            if (queryRes.data && queryRes.data.length > 0) {
                const normalizedData = queryRes.data.map((a) => ({
                    sort_key: a.sort_key.replace(`_${club_id}`, ''),
                    pri_key: a.pri_key.replace(`_${club_id}`, ''),
                }));
                const batchRes = await new_utils.batchConnectGetData(
                    USER_PRI_KEY,
                    CLUB_SORT_KEY,
                    normalizedData,
                    false
                );
                users = batchRes.data;
            }
        }
    } catch (error) {}
    return users;
};

async function createassemble(req, res) {
    try {
        const assembleid = uidGenerator.generateGUID();
        const { enter_club_id } = req.body;
        const { enter_club_name } = req.body;
        const user_id = req.body.host_id;
        let selectedusers = req.body.selected_users || [];
        const fromWeb =
            req.body.from_web && String(req.body.from_web) === 'true';
        if (String(req.body.is_allow_all) === 'true') {
            const queryClubRes = await new_utils.queryData(
                CLUB_PRI_KEY,
                enter_club_id,
                USER_PRI_KEY
            );
            if (queryClubRes.data && queryClubRes.data.length > 0) {
                const batchRes = await new_utils.batchConnectGetData(
                    USER_PRI_KEY,
                    CLUB_SORT_KEY,
                    queryClubRes.data,
                    false
                );
                selectedusers = batchRes.data;
            }
        } else if (String(req.body.is_following) === 'true') {
            selectedusers = await getFollowings(user_id, enter_club_id);
        }
        selectedusers = utils.removeDuplicated('user_id', selectedusers);
        selectedusers = selectedusers.filter((r) => r.user_id);
        if (!fromWeb) {
            selectedusers = selectedusers.filter((r) => r.user_id !== user_id);
        }
        const selected_user_ids = selectedusers.map((user) => user.user_id);
        selected_user_ids.push(user_id);

        const createPayload = {
            ...req.body,
            user_id,
            assemble_id: assembleid,
            table_name: PRI_KEY,
            enter_club_id,
            enter_club_name,
            selected_users: selected_user_ids,
            send_notification: false,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            assembleid,
            ASSEMBLY_SORT_KEY,
            assembleid,
            createPayload,
            models.assemble
        );
        if (createRes.data) {
            const user = await manager.getuser(user_id);
            createRes.data.user = user;
            sendInvitations(req, selectedusers, assembleid, createRes.data);
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
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function sendInvitations(req, selected_users, assemble_id, assemble) {
    const user_id = req.body.host_id;
    // const host_name =
    //     req.body.host_name ||
    //     `${audio.user.first_name} ${audio.user.last_name}`;
    let message = `You have been invited to the ${utils.getDisplayName(
        req.body.enter_club_name,
        '#'
    )} Room "${assemble.assemble_name}" starting now`;
    const is_started = typeof assemble.is_immediately === 'string' ? (assemble.is_immediately === 'true' ? true : false) : assemble.is_immediately; 
    if (!is_started) {
        const startTime = moment.tz(assemble.start_time, 'America/Los_Angeles');
        const startDate = startTime.format('YYYY/MM/DD');
        const startHour = startTime.format('hh:mm A');
        const startTimeZone = startTime.zoneName();
        message = `${utils.getDisplayName(
            req.body.enter_club_name,
            '#'
        )} Room "${
            assemble.assemble_name
        }" starting on ${startDate} at ${startHour} ${
            abbrs[`${startTimeZone}`]
        }`;
    } else {
        const updatePayload = {
            send_notification: true,
            assemble_id,
        };
        await new_utils.updateData(
            PRI_KEY,
            assemble_id,
            ASSEMBLY_SORT_KEY,
            assemble_id,
            updatePayload,
            models.assemble
        );
    }
    if (selected_users.length > 0) {
        await broadPushNotification(selected_users, message);
        await broadSocketNotification(
            MQTT_INVITE_TOPIC,
            selected_users,
            assemble,
            message
        );
    }
}

async function broadSocketNotification(baseTopic, users, indata, message = '') {
    users.map((user) => {
        const { user_id } = user;
        mqttClient.publishTopic(`${baseTopic}/${user_id}`, {
            message,
            data: indata,
        });
    });
}

async function broadPushNotification(users, message = '') {
    const users_with_tokens = users.filter((r) => r.fcm_token !== '');
    const users_tokens = users_with_tokens.map((r) => {
        if (r.fcm_token != '') {
            return r.fcm_token;
        }
    });
    await notification.sendMultiNotification(users_tokens, message);
}

async function sendUpdateMessage(baseTopic, data) {
    const userIds = data.selected_users.map((user_id) => ({
        user_id,
    }));
    let users = [];
    const usersRes = await new_utils.batchUserGetData(userIds);
    if (usersRes.data && usersRes.data.length > 0) {
        users = usersRes.data;
    }
    if (users.length > 0) {
        await broadSocketNotification(baseTopic, users, data, '');
    }
}

async function broadVoipPushNotification(users, assemble) {
    const filtered_users = users.filter((r) => r.call_token !== '');
    for (const index in filtered_users) {
        await notification.sendVoipNotification(
            assemble,
            filtered_users[index]
        );
    }
}

async function updateassembleorder(req, res) {
    try {
        const { assembles } = req.body;
        const { club_id } = req.body;
        for (const index in assembles) {
            const assemble = assembles[index];
            const updatePayload = {
                pinned_at: assemble.pinned_at,
                is_pinned: assemble.is_pinned,
                assemble_id: assemble.assemble_id,
            };
            await new_utils.updateData(
                PRI_KEY,
                assemble.assemble_id,
                ASSEMBLY_SORT_KEY,
                assemble.assemble_id,
                updatePayload,
                models.assemble
            );
        }
        mqttClient.publishTopic(MQTT_REORDER_TOPIC, {
            club_id,
        });
        utils.sendResult(
            200,
            { status: true, data: 'updated successfully' },
            res
        );
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function updateassemble(req, res) {
    try {
        const { assemble_id } = req.params;
        let updatePayload = {
            assemble_id,
        };
        if (
            req.body.is_immediately !== null &&
            req.body.is_immediately !== undefined
        ) {
            updatePayload = {
                ...req.body,
                assemble_id,
                send_notification: String(req.body.is_immediately) === 'true',
            };
        } else {
            updatePayload = {
                ...req.body,
                assemble_id,
            };
        }
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            assemble_id,
            ASSEMBLY_SORT_KEY,
            assemble_id,
            updatePayload,
            models.assemble
        );
        if (updateRes.data) {
            const user = await manager.getuser(updateRes.data.user_id);
            updateRes.data.user = user;
            sendUpdateMessage(MQTT_UPDATE_TOPIC, updateRes.data);
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
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function endAssembly(req, res) {
    try {
        const { assemble_id } = req.params;
        const getRes = await new_utils.getData(
            PRI_KEY,
            assemble_id,
            ASSEMBLY_SORT_KEY,
            assemble_id
        );
        if (getRes.data) {
            const user = await manager.getuser(getRes.data.user_id);
            getRes.data.user = user;
            await endAssemble(assemble_id);
            sendUpdateMessage(MQTT_END_TOPIC, getRes.data);
            sendUpdateMessage(MQTT_DELETE_TOPIC, getRes.data);
            utils.sendResult(200, { status: true, data: getRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function notifyassemble(req, res) {
    try {
        const { assemble_id } = req.params;
        const user_id = req.body.userid;
        const notified = String(req.body.notified) === 'true';
        const getRes = await new_utils.getData(
            PRI_KEY,
            assemble_id,
            ASSEMBLY_SORT_KEY,
            assemble_id
        );
        if (getRes.data) {
            let notify_users = [];
            if (
                getRes.data.notify_users &&
                Array.isArray(getRes.data.notify_users)
            ) {
                notify_users = getRes.data.notify_users;
            }
            if (notified) {
                if (!notify_users.includes(user_id)) {
                    notify_users.push(user_id);
                }
            } else {
                notify_users = notify_users.filter((a) => a !== user_id);
            }
            const updatePayload = {
                notify_users,
                assemble_id,
            };
            const updateRes = await new_utils.updateData(
                PRI_KEY,
                assemble_id,
                ASSEMBLY_SORT_KEY,
                assemble_id,
                updatePayload,
                models.assemble
            );
            if (updateRes.data) {
                const user = await manager.getuser(updateRes.data.user_id);
                updateRes.data.user = user;
                sendUpdateMessage(MQTT_UPDATE_TOPIC, updateRes.data);
                utils.sendResult(
                    201,
                    { status: true, data: updateRes.data },
                    res
                );
            } else {
                utils.sendResult(
                    400,
                    { status: false, data: updateRes.error },
                    res
                );
            }
        } else {
            utils.sendResult(404, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function clearAssemble(assembles) {
    for (const idx in assembles) {
        const assemble = assembles[idx];
        if (assemble.is_ended) {
            await endAssemble(assemble.assemble_id);
        }
    }
}

async function endAssemble(assemble_id) {
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            assemble_id,
            ASSEMBLY_SORT_KEY,
            assemble_id
        );
    } catch (error) {
        console.log('end assemble error', error);
    }
}

async function deleteassemble(req, res) {
    const { assemble_id } = req.params;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            assemble_id,
            ASSEMBLY_SORT_KEY,
            assemble_id
        );
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            assemble_id,
            ASSEMBLY_SORT_KEY,
            assemble_id
        );
        if (delRes.data) {
            if (getRes.data !== null) {
                const delData = getRes.data;
                const user = await manager.getuser(getRes.data.user_id);
                getRes.data.user = user;
                delData.is_ended = true;
                sendUpdateMessage(MQTT_END_TOPIC, getRes.data);
                sendUpdateMessage(MQTT_DELETE_TOPIC, getRes.data);
            }
            utils.sendResult(201, { status: true, data: delRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: delRes.error }, res);
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function getassemble(req, res) {
    const { assemble_id } = req.params;
    console.log(assemble_id);
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            assemble_id,
            ASSEMBLY_SORT_KEY,
            assemble_id
        );
        if (getRes.data) {
            const user = await manager.getuser(getRes.data.user_id);
            utils.sendResult(
                201,
                { status: true, data: { ...getRes.data, user } },
                res
            );
        } else {
            utils.sendResult(400, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

async function createLikeGained(req, res) {
    try {
        const { assemble_id } = req.body;
        const { userid } = req.body;
        const count = Number(req.body.likes_gained) || 1;
        let result;
        if (count > 0) {
            const createPayload = {
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            result = await new_utils.createData(
                PRI_KEY,
                assemble_id,
                LIKE_SORT_KEY,
                userid,
                createPayload,
                models.assemble_connect
            );
        } else {
            result = await new_utils.deleteData(
                PRI_KEY,
                assemble_id,
                LIKE_SORT_KEY,
                userid
            );
        }
        const updateRes = await new_utils.increseCount(
            PRI_KEY,
            assemble_id,
            ASSEMBLY_SORT_KEY,
            assemble_id,
            'likes_gained',
            count
        );
        if (result.data && result.data != null) {
            const user = await manager.getuser(updateRes.data.user_id);
            updateRes.data.user = user;
            if (updateRes.data) {
                sendUpdateMessage(MQTT_UPDATE_TOPIC, updateRes.data);
            }
            mqttClient.publishTopic(MQTT_LIKE_TOPIC, {
                user_id: userid,
                count,
                created_at: new Date().getTime(),
            });
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
    const { assemble_id } = req.params;
    const user_id = req.body.userid;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            assemble_id,
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
    getassembles,
    createassemble,
    updateassemble,
    updateassembleorder,
    deleteassemble,
    getassemble,
    createLikeGained,
    getLikeGained,
    notifyassemble,
    endAssembly,
};
