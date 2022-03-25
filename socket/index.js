const R = require('ramda');
const mqtt = require('mqtt');
const utils = require('../utils/utils');

const mqttIP = {
    public: 'mqtt://34.227.101.151:1883',
};
const MQTT_USERNAME = '7kvhq5sf8uf52yimz6lhnk25yhmwp5im';
const MQTT_PASSWORD = '49orbg0gj4caqz16v2bk6dxb2pbkrjy1';
const mqttcredential = {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
};
const reterivePeriod = 3000;
const reteriveInterval = null;
let mqttclient;
let isConnected = false;

function createClient() {
    mqttclient = mqtt.connect(mqttIP.public, mqttcredential);
    console.log(mqttIP.public, mqttcredential);
    mqttclient.on('connect', () => {
        isConnected = true;
        console.log('mqtt connected');
    });
    mqttclient.on('error', (err) => {
        console.log('mqtt error', err);
    });
    mqttclient.on('offline', () => {
        // console.log('mqtt offline');
    });
    mqttclient.on('close', () => {
        // console.log('mqtt close');
    });
    mqttclient.on('message', (topic, message) => {
        console.log('mqtt message', topic, message);
    });
}

function publishTopic(topic, pub_obj) {
    if (isConnected) {
        console.log('publish topic', topic);
        mqttclient.publish(
            topic.toLowerCase(),
            JSON.stringify(pub_obj),
            mqttcredential
        );
    }
}
module.exports = {
    createClient,
    publishTopic,
};
