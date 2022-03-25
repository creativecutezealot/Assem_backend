/// Routing club management
const R = require('ramda');
const phoneToken = require('generate-sms-verification-code');
const uidGenerator = require('node-unique-id-generator');
const express = require('express');
const assert = require('assert');
const crypto = require('crypto');
const { model } = require('mongoose');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const dbClient = require('../utils/dbClient');
const utils = require('../utils/utils');
const new_utils = require('../utils/new_utils');
const models = require('../model/index');
const smsManager = require('../utils/sms');
const manager = require('../services');

const { TBLNAME } = process.env;
const PRI_KEY = 'EMAILTEMPLATE';
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

async function getAllEmailTemplates(req, res) {
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
        const emailTemplates = [];
        if (resultFind.Items && resultFind.Items.length > 0) {
            for (const emailTemplate of resultFind.Items) {
                emailTemplates.push(emailTemplate);
            }
        }
        utils.sendResult(200, { status: true, data: emailTemplates }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function getEmailTemplate(req, res) {
    const template_id = req.params.id;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            template_id,
            CLUB_SORT_KEY,
            template_id
        );
        if (getRes.data) {
            console.log('this is the data');
            console.log(getRes.data);
            utils.sendResult(201, { status: true, data: getRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

async function createEmailTemplate(req, res) {
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
        if (resultFind.Items && resultFind.Items.length > 0) {
            for (const template of resultFind.Items) {
                if (template.type === req.body.type) {
                    utils.sendResult(
                        400,
                        {
                            status: false,
                            data: 'This template already exists!',
                            port: 400,
                        },
                        res
                    );
                    return;
                }
            }
        }
        const template_id = uidGenerator.generateGUID();
        const createPayload = {
            ...req.body,
            template_id: template_id,
            table_name: PRI_KEY,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            template_id,
            CLUB_SORT_KEY,
            template_id,
            createPayload,
            models.email_template
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

async function updateEmailTemplate(req, res) {
    try {
        console.log('req body: ', req.body, req.params.id);
        const template_id = req.params.id;
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            template_id,
            CLUB_SORT_KEY,
            template_id,
            req.body,
            models.email_template
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

module.exports = {
    getAllEmailTemplates,
    getEmailTemplate,
    createEmailTemplate,
    updateEmailTemplate,
};
