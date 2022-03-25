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
const sendMail = require('../utils/email');

const { TBLNAME } = process.env;
const ACODEINDEXNAME = 'acode-index';
const ACODETABLENAME = 'ACode';
const ACODEEMAILINDEXNAME = 'email-index';

async function getACodes(req, res) {
    const param = {
        TableName: ACODETABLENAME,
    };
    try {
        const result = await dbClient.scanItems(param);
        utils.sendResult(200, { status: true, data: result.Items }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function createACode(req, res) {
    try {
        req.assert('email', 'Email is not valid').isEmail();
        req.assert('email', 'Email cannot be blank').notEmpty();
        req.sanitize('email').normalizeEmail({ remove_dots: false });
        const errors = req.validationErrors();
        if (errors) {
            utils.sendResult(400, { status: false, data: errors[0].msg }, res);
            return;
        }
        const acode = phoneToken(6, { type: 'number' });
        // Body should be included the email
        const createPayload = {
            ...req.body,
            acode: `${acode}`,
        };
        const createModel = utils.generateInitDataModel(
            createPayload,
            models.acode
        );
        const createparams = {
            TableName: ACODETABLENAME,
            Item: createModel,
        };
        const resultCreate = await dbClient.putItem(createparams);
        utils.sendResult(201, { status: true, data: createModel }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function updateACode(req, res) {
    try {
        req.assert('is_used', 'Email cannot be blank').notEmpty();
        const errors = req.validationErrors();
        if (errors) {
            utils.sendResult(400, { status: false, data: errors[0].msg }, res);
            return;
        }
        const acode = req.params.code;
        const { expression, arttributeValues } = utils.generateUpdateDataModel(
            req.body,
            models.acode
        );
        const updateParams = {
            TableName: ACODETABLENAME,
            Key: {
                acode,
            },
            UpdateExpression: expression,
            ExpressionAttributeValues: arttributeValues,
            ReturnValues: 'ALL_NEW',
        };
        const result = await dbClient.updateItem(updateParams);
        utils.sendResult(201, { status: true, data: result.Attributes }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function deleteACode(req, res) {
    const acode = req.params.code;
    try {
        const deleteparams = {
            TableName: ACODETABLENAME,
            Key: {
                acode,
            },
        };
        const result = await dbClient.deleteItem(deleteparams);
        utils.sendResult(201, { status: true, data: result }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: 'no data' }, res);
    }
}

async function getACode(req, res) {
    const acode = req.params.code;
    try {
        const findparams = {
            TableName: TBLNAME,
            IndexName: ACODEINDEXNAME,
            KeyConditionExpression: 'acode =:acode',
            ExpressionAttributeValues: {
                ':acode': acode,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        if (resultFind.Count > 0) {
            utils.sendResult(
                201,
                { status: true, data: resultFind.Items[0] },
                res
            );
        } else {
            utils.sendResult(
                200,
                {
                    status: true,
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

module.exports = {
    getACodes,
    getACode,
    createACode,
    updateACode,
    deleteACode,
};
