const admin = require('firebase-admin');
const apn = require('apn');

const bundle_id = 'com.futureof.ios';
const apnOption = {
    token: {
        key: './futureof.p8',
        keyId: process.env.PUSH_K8_ID,
        teamId: process.env.DEV_TEAM_ID,
    },
    production: true,
};

const apnService = new apn.Provider(apnOption);

async function sendMultiNotification(tokens, data) {
    console.log('this is the niti data');
    console.log(tokens);
    console.log(data);
    try {
        if (tokens.length > 0) {
            const message = {
                notification: {
                    title: 'From Assembly',
                    body: data,
                },
                android: {
                    notification: {
                        sound: 'default',
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                        },
                    },
                },
                tokens,
            };
            try {
                const notiRes = await admin.messaging().sendMulticast(message);
                console.log('successfuly sent message:', notiRes);
                return true;
            } catch (error) {
                console.log('successfuly sent message error:', error);
                return false;
            }
        } else {
            console.log('there is no tokens');
        }
    } catch (error) {
        console.log(error);
    }
}

async function sendVoipNotification(assemble, user) {
    const notification = new apn.Notification();
    notification.alert = assemble.assemble_name;
    notification.rawPayload = {
        uuid: assemble.assemble_id,
        handle: user.user_id,
        callerName: `${assemble.assemble_name} Starting...`,
        aps: {
            'content-available': 1,
            'apns-push-type': 'background',
        },
    };
    notification.contentAvailable = 1;
    notification.priority = 10;
    notification.topic = `${bundle_id}.voip`;
    try {
        const sendRes = await apnService.send(notification, [user.call_token]);
        console.log('send voip notification', sendRes);
        return true;
    } catch (error) {
        console.log('send voip notification error', error);
        return false;
    }
}

module.exports = {
    sendMultiNotification,
    sendVoipNotification,
};
