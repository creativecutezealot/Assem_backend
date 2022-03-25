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
const PRI_KEY = 'EVENT';
const USER_PRI_KEY = 'USER';
const EVENT_SORT_KEY = 'METADATA';
const TABLEINDEXNAME = 'table_name-index';
const CLUB_PRI_KEY = 'CLUB';
const CLUB_SORT_KEY = 'METADATA';
const MQTT_INVITE_TOPIC = `presence/${process.env.MQTT_USERNAME}/invite/event`
const MQTT_UPDATE_TOPIC = `presence/${process.env.MQTT_USERNAME}/update/event`;
const MQTT_DELETE_TOPIC = `presence/${process.env.MQTT_USERNAME}/delete/event`;
const MQTT_END_TOPIC = `presence/${process.env.MQTT_USERNAME}/end/event`;

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

async function getEvents(req, res) {
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
        utils.sendResult(200, { status: true, data: result }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function createEvent(req, res) {
    try {
        const eventid = uidGenerator.generateGUID();
        const { event_name, event_time, enter_club_id } = req.body;
        const user_id = req.body.host_id;

        let selectedusers = [];
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
        selectedusers = utils.removeDuplicated('user_id', selectedusers);
        selectedusers = selectedusers.filter((r) => r.user_id);
        const selected_user_ids = selectedusers.map((user) => user.user_id);
        selected_user_ids.push(user_id);

        const createPayload = {
            ...req.body,
            user_id,
            event_id: eventid,
            table_name: PRI_KEY,
            notify_users: [],
            send_notification: false
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            eventid,
            EVENT_SORT_KEY,
            eventid,
            createPayload,
            models.event
        );
        if (createRes.data) {
            const user = await manager.getuser(user_id);
            createRes.data.user = user;
            sendInvitations(req, selectedusers, eventid, createRes.data);
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

async function updateEvent(req, res) {
    try {
        const { event_id } = req.params;
        let updatePayload = {
            ...req.body,
            event_id,
            send_notification: false
        };

        const updateRes = await new_utils.updateData(
            PRI_KEY,
            event_id,
            EVENT_SORT_KEY,
            event_id,
            updatePayload,
            models.event
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

async function endEvently(event_id) {
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            event_id,
            EVENT_SORT_KEY,
            event_id
        );
    } catch (error) {
        console.log('end assemble error', error);
    }
}

async function deleteEvent(req, res) {
    const { event_id } = req.params;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            event_id,
            EVENT_SORT_KEY,
            event_id
        );
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            event_id,
            EVENT_SORT_KEY,
            event_id
        );
        if (delRes.data) {
            if (getRes.data !== null) {
                const user = await manager.getuser(getRes.data.user_id);
                getRes.data.user = user;
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

async function getEvent(req, res) {
    const { event_id } = req.params;
    console.log(event_id);
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            event_id,
            EVENT_SORT_KEY,
            event_id
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

async function endEvent(req, res) {
    try {
        const { event_id } = req.params;
        const getRes = await new_utils.getData(
            PRI_KEY,
            event_id,
            EVENT_SORT_KEY,
            event_id
        );
        if (getRes.data) {
            const user = await manager.getuser(getRes.data.user_id);
            getRes.data.user = user;
            await endEvently(event_id);
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

async function notifyEvent(req, res) {
    try {
        const { event_id } = req.params;
        const user_id = req.body.userid;
        const notified = String(req.body.notified) === 'true';
        const getRes = await new_utils.getData(
            PRI_KEY,
            event_id,
            EVENT_SORT_KEY,
            event_id
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

            var unique_notify_users = notify_users.filter(onlyUnique)

            const updatePayload = {
                notify_users: unique_notify_users,
                event_id,
            };
            const updateRes = await new_utils.updateData(
                PRI_KEY,
                event_id,
                EVENT_SORT_KEY,
                event_id,
                updatePayload,
                models.event
            );
            if (updateRes.data) {
                const user = await manager.getuser(updateRes.data.host_id);
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
    const userIds = data.notify_users.map((user_id) => ({
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

async function broadSocketNotification(baseTopic, users, indata, message = '') {
    users.map((user) => {
        const { user_id } = user;
        mqttClient.publishTopic(`${baseTopic}/${user_id}`, {
            message,
            data: indata,
        });
    });
}

async function sendInvitations(req, selected_users, event_id, event) {
    const user_id = req.body.host_id;
    const startTime = moment.tz(event.event_time, 'America/Los_Angeles');
    const startDate = startTime.format('YYYY/MM/DD');
    const startHour = startTime.format('hh:mm A');
    const startTimeZone = startTime.zoneName();
    let message = `${utils.getDisplayName(
        req.body.enter_club_name,
        '#'
    )} Event "${event.event_name
        }" starting on ${startDate} at ${startHour} ${abbrs[`${startTimeZone}`]
        }`;

    if (selected_users.length > 0) {
        await broadPushNotification(selected_users, message);
        await broadSocketNotification(
            MQTT_INVITE_TOPIC,
            selected_users,
            event,
            message
        );
    }
}

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }

module.exports = {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    getEvent,
    notifyEvent,
    endEvent
};
