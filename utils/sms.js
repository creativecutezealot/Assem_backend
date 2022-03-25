const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function sendSMS(to, msg) {
    client.messages
        .create({
            from: '+14153225595',
            to,
            body: msg,
        })
        .then((message) => {})
        .catch((error) => {
            console.log('Send sms error ==>', error);
        });
}

async function sendVerification(phoneNumber) {
    // client.verify
    //     .services(process.env.VERFICATION_SID)
    //     .verifications.create({ to: `${phoneNumber}`, channel: 'sms' })
    //     .then((resp) => res.json(resp))
    //     .catch((error) => {
    //         console.error('sendVerification error: ', error);
    //     });
}

async function checkPhoneCode(phoneNumber, code) {
    // client.verify
    //     .services(process.env.VERFICATION_SID)
    //     .verificationChecks.create({ to: `${phoneNumber}`, code })
    //     .then((resp) => res.json(resp))
    //     .catch((error) => {
    //         console.error('checkPhoneCode error: ', error);
    //     });
}

async function sendEmailCode(to, sendResult) {
    // CREATE A NEW VERIFICATION HERE
    console.log(to);
    client.verify
        .services(process.env.VERFICATION_SID)
        .verifications.create({ to, channel: 'email' })
        .then((verification) => {
            console.log('Verification email sent', verification);
            sendResult(verification);
        })
        .catch((error) => {
            console.log(error);
            sendResult(error);
        });
}

async function checkEmailCode(to, code, checkResult) {
    client.verify
        .services(process.env.VERFICATION_SID)
        .verificationChecks.create({ to, code })
        .then((verification_check) => {
            checkResult(verification_check);
        })
        .catch((error) => {
            console.log(error);
            checkResult(error);
        });
}

module.exports = {
    sendSMS,
    sendEmailCode,
    checkEmailCode,
};
