/// Routing assemble management
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

const { TBLNAME } = process.env;
const CHANNELINDEXNAME = 'channel_id-index';
const PRI_KEY = 'VIEWER';
const VIEWER_SORT_KEY = 'METADATA';
const MQTT_TOPIC = `presence/${process.env.MQTT_USERNAME}/viewer/`;

function publishTopic(query, data) {
    const topic = `${MQTT_TOPIC}${query}`;
    mqttClient.publishTopic(topic, data);
}

async function getviewers(req, res) {
    /// not working
    // const param = {
    //     TableName: VIEWERTABLENAME,
    // };
    // try {
    //     const result = await dbClient.scanItems(param);
    //     utils.sendResult(200, { status: true, data: result.Items }, res);
    // } catch (error) {
    //     utils.sendResult(404, { status: false, data: error }, res);
    // }
}

async function createviewer(req, res) {
    console.log(req.body);
    try {
        // check the agora-uid is already existed
        // i think don't need to check the agora-uid is already existed

        var viewer_id = req.body.userid; // viewer_id is the same as user_id
        req.body.handselect = req.body.handselect === 'true';
        req.body.handup = req.body.handup === 'true';

        const createPayload = {
            ...req.body,
            viewer_id,
            user_id: req.body.userid,
            table_name: PRI_KEY,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            viewer_id,
            VIEWER_SORT_KEY,
            viewer_id,
            createPayload,
            models.viewer
        );
        if (createRes.data) {
            publishTopic('create', createRes.data);
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

async function updateviewer(req, res) {
    // check the agroa_uid in the viewer table

    try {
        const { viewer_id } = req.params;
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            viewer_id,
            VIEWER_SORT_KEY,
            viewer_id,
            req.body,
            models.viewer
        );
        if (updateRes.data) {
            publishTopic('update', updateRes.data);
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

async function deleteviewer(req, res) {
    const { viewer_id } = req.params;
    const { channel_id } = req.body; // channel_id is mandatory
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            viewer_id,
            VIEWER_SORT_KEY,
            viewer_id
        );
        if (delRes.data) {
            publishTopic('delete', { viewer_id, channel_id });
            utils.sendResult(201, { status: true, data: delRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: delRes.error }, res);
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function getviewer(req, res) {
    const { viewer_id } = req.params;
    console.log(viewer_id);
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            viewer_id,
            VIEWER_SORT_KEY,
            viewer_id
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

async function getViewersByChannel(req, res) {
    try {
        const { channel_id } = req.params;
        console.log(channel_id);
        const findparams = {
            TableName: TBLNAME,
            IndexName: CHANNELINDEXNAME,
            KeyConditionExpression: 'channel_id = :channelstr',
            ExpressionAttributeValues: {
                ':channelstr': channel_id,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        utils.sendResult(200, { status: true, data: resultFind.Items }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

module.exports = {
    getviewers,
    createviewer,
    updateviewer,
    deleteviewer,
    getviewer,
    getViewersByChannel,
};
