/// Routing audio management
const R = require('ramda');
const phoneToken = require('generate-sms-verification-code');
const uidGenerator = require('node-unique-id-generator');
const express = require('express');
const assert = require('assert');
const crypto = require('crypto');
const dbClient = require('../utils/dbClient');
const utils = require('../utils/utils');
const sendMail = require('../utils/email');
const models = require('../model/index');
const new_utils = require('../utils/new_utils');
const mqttClient = require('../socket');
const notification = require('../utils/notificaion');
const manager = require('../services');

const { TBLNAME } = process.env;
const PRI_KEY = 'VOICENOTE';
const USER_PRI_KEY = 'USER';
const VOICENOTE_SORT_KEY = 'METADATA';
const CONNECT_SORT_KEY = 'CONNECT';
const TABLEINDEXNAME = 'table_name-index';
const HELLO_AUDIO_ID_INDEX = 'hello_audio_id-index';
const CLUB_PRI_KEY = 'CLUB';
const CLUB_SORT_KEY = 'METADATA';
const LIKE_SORT_KEY = 'LIKE';
const MQTT_TOPIC = `presence/${process.env.MQTT_USERNAME}/invite/voicenote`;
const MQTT_VOICE_TOPIC = `presence/${process.env.MQTT_USERNAME}/update/voicenote`;

async function getVoiceNotes(req, res) {
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

async function getUsersByClubId(club_id) {
    const queryRes = await new_utils.queryData(
        CLUB_PRI_KEY,
        club_id,
        USER_PRI_KEY
    );
    let users = [];
    if (queryRes.data) {
        /// After queried, we need to get data with userIds
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
    }
    return users;
}

async function createHelloVoiceNotes(req, res) {
    try {
        const user_id = req.body.userid;
        const { enter_club_id } = req.body;
        const { enter_club_name } = req.body;
        const users = await getUsersByClubId(enter_club_id);
        const createdVoiceNotes = [];
        for (const user of users) {
            const receiver_id = user.user_id;
            const voicenote_id = uidGenerator.generateGUID();
            let hello_audio_id = voicenote_id;
            if (
                Object.prototype.hasOwnProperty.call(
                    req.body,
                    'hello_audio_id'
                ) &&
                req.body.hello_audio_id !== ''
            ) {
                hello_audio_id = req.body.hello_audio_id;
            }
            const createPayload = {
                ...req.body,
                user_id,
                receiver_id,
                voicenote_id,
                table_name: PRI_KEY,
                enter_club_id,
                enter_club_name,
                from_manager: true,
            };
            const createRes = await new_utils.createData(
                PRI_KEY,
                receiver_id,
                VOICENOTE_SORT_KEY,
                voicenote_id,
                createPayload,
                models.voice_note
            );
            if (createRes.data) {
                sendInvitations(req, receiver_id, voicenote_id, createRes.data);
                createdVoiceNotes.push(createRes.data);
            }
        }
        utils.sendResult(200, { status: true, data: createdVoiceNotes }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function deleteHelloVoiceNotes(req, res) {
    try {
        const user_id = req.body.userid;
        const { audio_id } = req.params;
        const findparams = {
            TableName: TBLNAME,
            IndexName: HELLO_AUDIO_ID_INDEX,
            KeyConditionExpression: 'hello_audio_id = :hello_audio_id',
            ExpressionAttributeValues: {
                ':hello_audio_id': audio_id,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        console.log(resultFind);
        if (resultFind.Items && resultFind.Items.length > 0) {
            for (const item of resultFind.Items) {
                await new_utils.deleteData(
                    PRI_KEY,
                    item.receiver_id,
                    VOICENOTE_SORT_KEY,
                    item.voicenote_id
                );
            }
        }
        utils.sendResult(200, { status: true, data: true }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function createVoiceNote(req, res) {
    try {
        const user_id = req.body.userid;
        const { receiver_id } = req.body;
        const { enter_club_id } = req.body;
        const { enter_club_name } = req.body;
        const voicenote_id = uidGenerator.generateGUID();
        let hello_audio_id = voicenote_id;
        if (
            Object.prototype.hasOwnProperty.call(req.body, 'hello_audio_id') &&
            req.body.hello_audio_id !== ''
        ) {
            hello_audio_id = req.body.hello_audio_id;
        }
        const createPayload = {
            ...req.body,
            hello_audio_id,
            user_id,
            receiver_id,
            voicenote_id,
            table_name: PRI_KEY,
            enter_club_id,
            enter_club_name,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            receiver_id,
            VOICENOTE_SORT_KEY,
            voicenote_id,
            createPayload,
            models.voice_note
        );
        if (createRes.data) {
            sendInvitations(req, receiver_id, voicenote_id, createRes.data);
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

async function createVoiceNoteWithAudio(receiver_id, audio) {
    const voicenote_id = uidGenerator.generateGUID();
    const createPayload = {
        ...audio,
        hello_audio_id: audio.audio_id,
        receiver_id,
        voicenote_id,
        table_name: PRI_KEY,
        from_manager: true,
    };
    await new_utils.createData(
        PRI_KEY,
        receiver_id,
        VOICENOTE_SORT_KEY,
        voicenote_id,
        createPayload,
        models.voice_note
    );
}

// Function send invitation

async function sendInvitations(req, receiver_id, voicenote_id, voice_note) {
    const user_id = req.body.userid;
    const host_name = req.body.host_name || 'Admin';
    const message = `${utils.getDisplayName(
        host_name
    )} has sent you a VoiceNote in ${utils.getDisplayName(
        req.body.enter_club_name,
        '#'
    )}`;
    broadPushNotification(receiver_id, message);
    broadSocketNotification(user_id, receiver_id, voice_note, message);
}

async function broadSocketNotification(
    user_id,
    receiver_id,
    voice_note,
    message = ''
) {
    const user = await manager.getuser(user_id);
    const sendData = { ...voice_note, user };
    mqttClient.publishTopic(`${MQTT_TOPIC}/${receiver_id}`, {
        message,
        data: sendData,
    });
}

async function broadPushNotification(receiver_id, message = '') {
    const receiver = await manager.getuser(receiver_id);
    if (receiver.fcm_token !== '') {
        notification.sendMultiNotification([receiver.fcm_token], message);
    }
}

async function updateVoiceNote(req, res) {
    try {
        const { voicenote_id } = req.params;
        const { receiver_id } = req.params;
        const updatePayload = {
            ...req.body,
            voicenote_id,
            receiver_id,
        };
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            receiver_id,
            VOICENOTE_SORT_KEY,
            voicenote_id,
            updatePayload,
            models.voice_note
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

async function deleteVoiceNote(req, res) {
    const { voicenote_id } = req.params;
    const { receiver_id } = req.params;
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            receiver_id,
            VOICENOTE_SORT_KEY,
            voicenote_id
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

async function getVoiceNote(req, res) {
    const { voicenote_id } = req.params;
    const { receiver_id } = req.params;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            receiver_id,
            VOICENOTE_SORT_KEY,
            voicenote_id
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

module.exports = {
    getVoiceNotes,
    createVoiceNote,
    createHelloVoiceNotes,
    deleteHelloVoiceNotes,
    updateVoiceNote,
    deleteVoiceNote,
    getVoiceNote,
    createVoiceNoteWithAudio,
};
