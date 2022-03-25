const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRIDAPIKEY);
async function sendEmail(msg) {
    try {
        await sgMail.send(msg);
        console.log('sendEmail: ', msg);
        return true;
    } catch (error) {
        console.error('sendEmail error: ', error);
        if (error.response) {
            console.error(error.response.body);
        }
        return false;
    }
}
module.exports = {
    sendEmail,
};
