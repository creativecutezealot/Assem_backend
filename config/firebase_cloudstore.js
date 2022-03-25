const admin = require('firebase-admin');
const serviceAccount = require('./ServiceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://f-e9d60.firebaseio.com',
});
const db = admin.firestore();
module.exports = db;
