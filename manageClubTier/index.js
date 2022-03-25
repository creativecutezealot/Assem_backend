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
const PRI_KEY = 'CLUBTIER';
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

async function getAllClubTiers(req, res) {
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
        const clubtiers = [];
        if (resultFind.Items && resultFind.Items.length > 0) {
            for (const clubtier of resultFind.Items) {
                clubtiers.push(clubtier);
            }
        }
        utils.sendResult(200, { status: true, data: clubtiers }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function getClubTier(req, res) {
    const clubtier_id = req.params.id;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            clubtier_id,
            CLUB_SORT_KEY,
            clubtier_id
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

async function createClubTier(req, res) {
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
            for (const clubtier of resultFind.Items) {
                if (clubtier.clubtier_name === req.body.clubtier_name) {
                    utils.sendResult(
                        400,
                        {
                            status: false,
                            data: 'This tier already exists!',
                            port: 400,
                        },
                        res
                    );
                    return;
                }
            }
        }
        const unit_amount = req.body.price * 100;
        const price = await stripe.prices.create({
            unit_amount,
            currency: 'usd',
            recurring: { interval: 'month' },
            product: process.env.STRIPE_PLAN_ID,
        });
        if (price) {
            const clubtierid = uidGenerator.generateGUID();
            const createPayload = {
                ...req.body,
                clubtier_id: clubtierid,
                price_id: price.id,
                table_name: PRI_KEY,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            const createRes = await new_utils.createData(
                PRI_KEY,
                clubtierid,
                CLUB_SORT_KEY,
                clubtierid,
                createPayload,
                models.club_tier
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
        } else {
            utils.sendResult(
                400,
                {
                    status: false,
                    data: 'This price could not be created!',
                    port: 400,
                },
                res
            );
        }
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error, port: 400 }, res);
    }
}

async function updateClubTier(req, res) {
    try {
        console.log('req body: ', req.body);
        const clubtier_id = req.params.id;
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            clubtier_id,
            CLUB_SORT_KEY,
            clubtier_id,
            req.body,
            models.club_tier
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

async function deleteClubTier(req, res) {
    const clubtier_id = req.params.id;
    try {
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            clubtier_id,
            CLUB_SORT_KEY,
            clubtier_id
        );
        if (delRes.data) {
            utils.sendResult(200, { status: true, data: delRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: delRes.error }, res);
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

module.exports = {
    getAllClubTiers,
    getClubTier,
    createClubTier,
    updateClubTier,
    deleteClubTier,
};
