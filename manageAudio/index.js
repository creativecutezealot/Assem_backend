/// Routing audio management
const R = require('ramda');
const phoneToken = require('generate-sms-verification-code');
const uidGenerator = require('node-unique-id-generator');
const express = require('express');
const assert = require('assert');
const crypto = require('crypto');
const { Client } = require('podcast-api');
const dbClient = require('../utils/dbClient');
const utils = require('../utils/utils');
const sendMail = require('../utils/email');
const models = require('../model/index');
const new_utils = require('../utils/new_utils');
const mqttClient = require('../socket');
const notification = require('../utils/notificaion');
const manager = require('../services');
const manageEmailTemplate = require('../manageEmailTemplate')

const { TBLNAME } = process.env;
const PRI_KEY = 'AUDIO';
const INDEXING_PRI_KEY = 'INDEXINGAUDIO';
const TRACK_PRI_KEY = 'RECORDTRACK';
const TUTOR_PRI_KEY = 'TUTORAUDIO';
const TUTOR_ID = 'TUTORAUDIOID';
const USER_PRI_KEY = 'USER';
const AUDIO_SORT_KEY = 'METADATA';
const CONNECT_SORT_KEY = 'CONNECT';
const TABLEINDEXNAME = 'table_name-index';
const CLUB_PRI_KEY = 'CLUB';
const CLUB_SORT_KEY = 'METADATA';
const LIKE_SORT_KEY = 'LIKE';
const MQTT_INVITE_TOPIC = `presence/${process.env.MQTT_USERNAME}/invite/audio`;
const MQTT_UPDATE_TOPIC = `presence/${process.env.MQTT_USERNAME}/update/audio`;
const MQTT_DELETE_TOPIC = `presence/${process.env.MQTT_USERNAME}/delete/audio`;
const MQTT_REORDER_TOPIC = `presence/${process.env.MQTT_USERNAME}/reorder/audio`;

const client = Client({ apiKey: process.env.PODCASET_API_KEY });

async function getAudios(req, res) {
    try {
        const result = await getAllAudios();
        utils.sendResult(200, { status: true, data: result }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function getAllAudios() {
    const findparams = {
        TableName: TBLNAME,
        IndexName: TABLEINDEXNAME,
        KeyConditionExpression: 'table_name = :table_name',
        ExpressionAttributeValues: {
            ':table_name': PRI_KEY,
        },
    };
    const resultFind = await dbClient.getItems(findparams);
    return resultFind.Items;
}

async function createAudio(req, res) {
    try {
        const user_id = req.body.userid;
        const { enter_club_id } = req.body;
        const { enter_club_name } = req.body;
        const audioid = uidGenerator.generateGUID();
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
            user_id: req.body.userid,
            audio_id: audioid,
            table_name: PRI_KEY,
            enter_club_id,
            enter_club_name,
            selected_users: selected_user_ids,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            audioid,
            AUDIO_SORT_KEY,
            audioid,
            createPayload,
            models.audio
        );
        if (createRes.data) {
            const user = await manager.getuser(req.body.userid);
            const findparams = {
                TableName: TBLNAME,
                IndexName: TABLEINDEXNAME,
                KeyConditionExpression: 'table_name = :table_name',
                ExpressionAttributeValues: {
                    ':table_name': 'EMAILTEMPLATE',
                },
            };
            const resultFind = await dbClient.getItems(findparams);
            if (resultFind.Items && resultFind.Items.length > 0) {
                const emailTemplate = resultFind.Items.find(item => item.type === 'submit');
                if (emailTemplate.is_send) {
                    let htmlString = '';
                    if (emailTemplate.content.includes('@username')) {
                        htmlString = emailTemplate.content.replace('@username', `@${createRes.data.host_name}`);
                    }
                    
                    if (emailTemplate.content.includes('@clubname')) {
                        htmlString = emailTemplate.content.replace('@clubname', `@${createRes.data.enter_club_name}`);
                    }
    
                    if (emailTemplate.content.includes('@managername') && user.user_role === 'manager') {
                        htmlString = emailTemplate.content.replace('@managername', `@${createRes.data.host_name}`)
                    }
    
                    if (!emailTemplate.content.includes('@username') && !emailTemplate.content.includes('@clubname') && !emailTemplate.content.includes('@managername')) {
                        htmlString = emailTemplate.content;
                    }
    
                    const emailOption = {
                        to: [user.email],
                        from: 'info@assembly.us',
                        subject: 'Assembly Audio Submitted',
                        text: 'Assembly Audio Submitted',
                        html: `${htmlString}`,
                    };
                    await sendMail.sendEmail(emailOption);
                }
            }
            createRes.data.user = user;
            sendInvitations(req, selectedusers, audioid, createRes.data);
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

// Function send invitation

async function sendInvitations(req, selected_users, audio_id, audio) {
    const user_id = req.body.userid;
    const host_name = `${audio.user.first_name} ${audio.user.last_name}`;
    const message = `${utils.getDisplayName(
        host_name
    )} has posted an Audio in ${utils.getDisplayName(
        req.body.enter_club_name,
        '#'
    )}`;
    if (selected_users.length > 0) {
        await broadPushNotification(selected_users, message);
        await broadSocketNotification(
            MQTT_INVITE_TOPIC,
            selected_users,
            audio,
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

async function updateAudioOrder(req, res) {
    try {
        const { audios } = req.body;
        const { club_id } = req.body;
        for (const index in audios) {
            const audio = audios[index];
            const updatePayload = {
                pinned_at: audio.pinned_at,
                is_pinned: audio.is_pinned,
                audio_id: audio.audio_id,
            };
            await new_utils.updateData(
                PRI_KEY,
                audio.audio_id,
                AUDIO_SORT_KEY,
                audio.audio_id,
                updatePayload,
                models.audio
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

async function updateAudio(req, res) {
    try {
        const { audio_id } = req.params;
        const updatePayload = {
            ...req.body,
            audio_id,
        };
        const updateRes = await new_utils.updateData(
            PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            audio_id,
            updatePayload,
            models.audio
        );
        if (updateRes.data) {
            const user = await manager.getuser(updateRes.data.user_id);
            const AudioManager = await manager.getuser(req.body.manager_id);
            console.log('updateAudio: ', updateRes.data, AudioManager);
            const findparams = {
                TableName: TBLNAME,
                IndexName: TABLEINDEXNAME,
                KeyConditionExpression: 'table_name = :table_name',
                ExpressionAttributeValues: {
                    ':table_name': 'EMAILTEMPLATE',
                },
            };
            const resultFind = await dbClient.getItems(findparams);
            if (resultFind.Items && resultFind.Items.length > 0) {
                if (req.body.audio_status) {
                    if (req.body.audio_status === 'approved') {
                        const emailTemplate = resultFind.Items.find(item => item.type === 'approve');
                        if (emailTemplate.is_send) {
                            let htmlString = '';
                            if (emailTemplate.content.includes('@username')) {
                                htmlString = emailTemplate.content.replace('@username', `@${updateRes.data.host_name}`);
                            }
                            
                            if (emailTemplate.content.includes('@clubname')) {
                                htmlString = emailTemplate.content.replace('@clubname', `@${updateRes.data.enter_club_name}`);
                            }
    
                            if (emailTemplate.content.includes('@managername')) {
                                htmlString = emailTemplate.content.replace('@managername', `@${AudioManager.first_name} ${AudioManager.last_name}`)
                            }
    
                            if (!emailTemplate.content.includes('@username') && !emailTemplate.content.includes('@clubname') && !emailTemplate.content.includes('@managername')) {
                                htmlString = emailTemplate.content;
                            }
                            
                            const emailOption = {
                                to: [user.email],
                                from: 'info@assembly.us',
                                subject: 'Assembly Audio Approved',
                                text: 'Assembly Audio Approved',
                                html: `${htmlString}`,
                            };
                            await sendMail.sendEmail(emailOption);
                        }
                    } else if (req.body.audio_status === 'rejected') {
                        const emailTemplate = resultFind.Items.find(item => item.type === 'reject');
                        if (emailTemplate.is_send) {
                            let htmlString = '';
                            if (emailTemplate.content.includes('@username')) {
                                htmlString = emailTemplate.content.replace('@username', `@${updateRes.data.host_name}`);
                            }
                            
                            if (emailTemplate.content.includes('@clubname')) {
                                htmlString = emailTemplate.content.replace('@clubname', `@${updateRes.data.enter_club_name}`);
                            }
    
                            if (emailTemplate.content.includes('@managername')) {
                                htmlString = emailTemplate.content.replace('@managername', `@${AudioManager.first_name} ${AudioManager.last_name}`)
                            }
    
                            if (!emailTemplate.content.includes('@username') && !emailTemplate.content.includes('@clubname') && !emailTemplate.content.includes('@managername')) {
                                htmlString = emailTemplate.content;
                            }
    
                            const emailOption = {
                                to: [user.email],
                                from: 'info@assembly.us',
                                subject: 'Assembly Audio Rejected',
                                text: 'Assembly Audio Rejected',
                                html: `${htmlString}`,
                            };
                            await sendMail.sendEmail(emailOption);
                        }
                    }
                }
            }
            updateRes.data.user = user;
            sendUpdateMessage(MQTT_UPDATE_TOPIC, updateRes.data);
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

async function deleteAudio(req, res) {
    const { audio_id } = req.params;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            audio_id
        );
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            audio_id
        );
        if (delRes.data) {
            const user = await manager.getuser(getRes.data.user_id);
            getRes.data.user = user;
            const findparams = {
                TableName: TBLNAME,
                IndexName: TABLEINDEXNAME,
                KeyConditionExpression: 'table_name = :table_name',
                ExpressionAttributeValues: {
                    ':table_name': 'EMAILTEMPLATE',
                },
            };
            const resultFind = await dbClient.getItems(findparams);
            const emailTemplate = resultFind.Items.find(item => item.type === 'delete');
            if (emailTemplate.is_send) {
                let htmlString = '';
                if (emailTemplate.content.includes('@username')) {
                    htmlString = emailTemplate.content.replace('@username', `@${delRes.data.host_name}`);
                }
                
                if (emailTemplate.content.includes('@clubname')) {
                    htmlString = emailTemplate.content.replace('@clubname', `@${delRes.data.enter_club_name}`);
                }
    
                if (emailTemplate.content.includes('@managername')) {
                    htmlString = emailTemplate.content.replace('@managername', `@${delRes.data.enter_club_name}`)
                }
    
                if (!emailTemplate.content.includes('@username') && !emailTemplate.content.includes('@clubname') && !emailTemplate.content.includes('@managername')) {
                    htmlString = emailTemplate.content;
                }
    
                const emailOption = {
                    to: [user.email],
                    from: 'info@assembly.us',
                    subject: 'Assembly Audio Deleted',
                    text: 'Assembly Audio Deleted',
                    html: `${htmlString}`,
                };
                await sendMail.sendEmail(emailOption);
            }
            sendUpdateMessage(MQTT_DELETE_TOPIC, getRes.data);
            utils.sendResult(201, { status: true, data: delRes.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: delRes.error }, res);
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function getAudio(req, res) {
    const { audio_id } = req.params;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            audio_id
        );
        if (getRes.data) {
            const user = await manager.getuser(getRes.data.user_id);
            getRes.data.user = user;
            utils.sendResult(201, { status: true, data: getRes.data }, res);
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
        const { audio_id } = req.body;
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
                audio_id,
                LIKE_SORT_KEY,
                userid,
                createPayload,
                models.audio_connect
            );
        } else {
            result = await new_utils.deleteData(
                PRI_KEY,
                audio_id,
                LIKE_SORT_KEY,
                userid
            );
        }
        const updateRes = await new_utils.increseCount(
            PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            audio_id,
            'likes_gained',
            count
        );
        if (result.data && result.data != null) {
            const user = await manager.getuser(updateRes.data.user_id);
            updateRes.data.user = user;
            if (updateRes.data) {
                sendUpdateMessage(MQTT_UPDATE_TOPIC, updateRes.data);
            }
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
    const { audio_id } = req.params;
    const user_id = req.body.userid;
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            audio_id,
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

async function createTutorAudio(req, res) {
    const createPayload = {
        ...req.body,
        table_name: TUTOR_PRI_KEY,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    const getRes = await new_utils.getData(
        TUTOR_PRI_KEY,
        TUTOR_ID,
        AUDIO_SORT_KEY,
        TUTOR_ID
    );
    if (getRes.data) {
        const updatePayload = {
            ...req.body,
        };
        const updateRes = await new_utils.updateData(
            TUTOR_PRI_KEY,
            TUTOR_ID,
            AUDIO_SORT_KEY,
            TUTOR_ID,
            updatePayload,
            models.tutor_audio
        );
        utils.sendResult(200, { status: true, data: updateRes.data }, res);
    } else {
        const result = await new_utils.createData(
            TUTOR_PRI_KEY,
            TUTOR_ID,
            AUDIO_SORT_KEY,
            TUTOR_ID,
            createPayload,
            models.tutor_audio
        );
        utils.sendResult(201, { status: true, data: result.data }, res);
    }
}

async function updateTutorAudio(req, res) {
    const updatePayload = {
        ...req.body,
    };
    const updateRes = await new_utils.updateData(
        TUTOR_PRI_KEY,
        TUTOR_ID,
        AUDIO_SORT_KEY,
        TUTOR_ID,
        updatePayload,
        models.tutor_audio
    );
    utils.sendResult(200, { status: true, data: updateRes.data }, res);
}

async function getTutorAudio(req, res) {
    const getRes = await new_utils.getData(
        TUTOR_PRI_KEY,
        TUTOR_ID,
        AUDIO_SORT_KEY,
        TUTOR_ID
    );
    utils.sendResult(200, { status: true, data: getRes.data }, res);
}

async function createAudioIndexing(req, res) {
    try {
        const { audio_id } = req.body;
        const indexing_id = uidGenerator.generateGUID();
        const { start_time } = req.body; // hh:mm:ss
        const { description } = req.body; // hh:mm:ss
        const createPayload = {
            start_time,
            description,
            table_name: INDEXING_PRI_KEY,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const result = await new_utils.createData(
            INDEXING_PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            indexing_id,
            createPayload,
            models.audio_indexing
        );
        utils.sendResult(201, { status: true, data: result.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function updateAudioIndexing(req, res) {
    try {
        const { audio_id } = req.params;
        const { indexing_id } = req.params;
        const { start_time } = req.body;
        const { description } = req.body;
        const updatePayload = {
            start_time,
            description,
        };
        const updateRes = await new_utils.updateData(
            INDEXING_PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            indexing_id,
            updatePayload,
            models.audio_indexing
        );
        utils.sendResult(200, { status: true, data: updateRes.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function deleteAudioIndexing(req, res) {
    try {
        const { audio_id } = req.params;
        const { indexing_id } = req.params;
        const result = await new_utils.deleteData(
            INDEXING_PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            indexing_id
        );
        utils.sendResult(200, { status: true, data: result.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function getAudioIndexing(req, res) {
    try {
        const { audio_id } = req.params;
        const queryIndexingRes = await new_utils.queryData(
            INDEXING_PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY
        );
        utils.sendResult(
            200,
            { status: true, data: queryIndexingRes.data },
            res
        );
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function createRecordTrack(req, res) {
    try {
        const { userid } = req.body;
        const { audio_id } = req.body;
        const { play_time } = req.body;
        const payload = {
            play_time,
            table_name: TRACK_PRI_KEY,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const getTrackRes = await new_utils.getData(
            TRACK_PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            userid
        );
        if (getTrackRes.data) {
            const updateRes = await new_utils.updateData(
                TRACK_PRI_KEY,
                audio_id,
                AUDIO_SORT_KEY,
                userid,
                payload,
                models.audio_track
            );
            utils.sendResult(200, { status: true, data: updateRes.data }, res);
        } else {
            const createRes = await new_utils.createData(
                TRACK_PRI_KEY,
                audio_id,
                AUDIO_SORT_KEY,
                userid,
                payload,
                models.audio_track
            );
            utils.sendResult(200, { status: true, data: createRes.data }, res);
        }
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function getRecordTrack(req, res) {
    try {
        const { userid } = req.body;
        const { audio_id } = req.params;
        const getTrackRes = await new_utils.getData(
            TRACK_PRI_KEY,
            audio_id,
            AUDIO_SORT_KEY,
            userid
        );
        utils.sendResult(200, { status: true, data: getTrackRes.data }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

function searchPodcast(req, res) {
    let page_offset = 0;
    const { q, offset } = req.query;
    if (q === undefined || q === '') {
        utils.sendResult(
            400,
            { status: false, data: 'Parameter q is required' },
            res
        );
    }
    if (offset === undefined || offset === '') {
        page_offset = 0;
    } else {
        page_offset = offset;
    }
    const sort_by_date = req.query.sort_by_date ? req.query.sort_by_date : 0;
    const type = req.query.type ? req.query.type : 'episode';
    client
        .search({
            q: q,
            sort_by_date: sort_by_date,
            type: type,
            offset: offset,
        })
        .then((response) => {
            utils.sendResult(200, { status: true, data: response.data }, res);
        })
        .catch((error) => {
            console.log(error);
            utils.sendResult(400, { status: false, data: error }, res);
        });
}

function getEpisodes(req, res) {
    const { podcast_id } = req.params;
    if (podcast_id === undefined || podcast_id === '') {
        utils.sendResult(
            400,
            { status: false, data: 'Parameter podcast_id is required' },
            res
        );
    }
    client
        .fetchPodcastById({
            id: podcast_id,
        })
        .then((response) => {
            utils.sendResult(200, { status: true, data: response.data }, res);
        })
        .catch((error) => {
            console.log(error);
            utils.sendResult(400, { status: false, data: error }, res);
        });
}

module.exports = {
    getAllAudios,
    getAudios,
    createAudio,
    updateAudio,
    updateAudioOrder,
    deleteAudio,
    getAudio,
    createLikeGained,
    getLikeGained,
    createTutorAudio,
    updateTutorAudio,
    getTutorAudio,
    createAudioIndexing,
    deleteAudioIndexing,
    updateAudioIndexing,
    getAudioIndexing,
    createRecordTrack,
    getRecordTrack,
    searchPodcast,
    getEpisodes,
};
