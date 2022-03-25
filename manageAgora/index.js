/// Routing assemble management
const R = require('ramda');
const crypto = require('crypto');
const {
    RtcTokenBuilder,
    RtmTokenBuilder,
    RtcRole,
    RtmRole,
} = require('agora-access-token');
const utils = require('../utils/utils');

const appID = process.env.AGORA_APP_ID;
const appCertificate = process.env.AGORA_APP_CERT;
const expirationTimeInSeconds = 3600 * 72;
async function getAgoraToken(req, res) {
    /// not working
    const channe_id = req.params.channel_id;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    const role = RtcRole.PUBLISHER;
    const uid = randU32Sync();
    // IMPORTANT! Build token with either the uid or with the user account. Comment out the option you do not want to use below.

    // Build token with uid
    const token = RtcTokenBuilder.buildTokenWithUid(
        appID,
        appCertificate,
        channe_id,
        uid,
        role,
        privilegeExpiredTs
    );
    console.log(`Token With Integer Number Uid: ${token}`, uid);
    utils.sendResult(200, { status: true, token, uid }, res);
}
function randU32Sync() {
    return crypto.randomBytes(4).readUInt32BE(0, true);
}

module.exports = {
    getAgoraToken,
};
