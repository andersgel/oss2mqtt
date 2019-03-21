const MBusParser = require("mbusparser");
const OssBrikkenUSB = "/dev/ttyUSB0";
const SerialPort = require('serialport');
const Mqtt = require('mqtt');

const mqttUrl = 'mqtt://192.168.10.6';
const configName = 'energyMeter'

var mqttConnected = false;
var timeAndDate = new Date();
var prevHour = 0;
var prevEnergy = 0;
var prevHourAvgPower = 0;


const port = new SerialPort(OssBrikkenUSB, {
    baudRate: 115200
}, function (err) {
    if (err) {
        return console.log('Error: ', err.message)
    }
})


 //Connect to mqtt
    console.info('mqtt trying to connect', mqttUrl);

   var mqtt = Mqtt.connect(mqttUrl, {
        clientId: configName + '_' + Math.random().toString(16).substr(2, 8),
        will: {topic: configName + '/connected', payload: '0', retain: true},
        rejectUnauthorized: false
    });

    mqtt.on('connect', () => {
        mqttConnected = true;
        console.info('mqtt connected', mqttUrl);
        mqtt.publish(configName + '/connected', '1', {retain: true});
    });

    mqtt.on('close', () => {
        if (mqttConnected) {
            mqttConnected = false;
            console.info('mqtt closed ' + mqttUrl);
        }
    });

    mqtt.on('error', err => {
        console.error('mqtt', err.toString());
    });

    mqtt.on('offline', () => {
        console.error('mqtt offline');
    });

    mqtt.on('reconnect', () => {
        console.info('mqtt reconnect');
    });



let prevData = Buffer.alloc(0);
port.on('data', function (data) {
    prevData = Buffer.concat([prevData, data], prevData.length + data.length);
    remainingIndex = 0;
    for (i = 1; i <= (prevData.length / 40); i++){
        console.log(prevData.slice((i - 1) * 40, (i * 40) - 1));
        remainingIndex = i * 40;
    }
    console.log(prevData.slice(remainingIndex, prevData.length));
    console.log(prevData.length);
    let parsed = new MBusParser(prevData.toString('base64'));
    if (parsed.type != "error") {
        // Successfully parsed
        prevData = Buffer.alloc(0);
        if ((prevEnergy == 0) && !(parsed.data.a_plus === undefined)) {
            prevEnergy = parsed.data.a_plus;
        }
        timeAndDate = new Date();
        if ((prevHour != timeAndDate.getHours()) && (!isNaN(parsed.data.a_plus)) && !(parsed.data.a_plus === undefined)) {
            console.log ("update prev hour avg");
            console.log (prevEnergy);
            console.log (parsed.data.a_plus);
            prevHourAvgPower = parsed.data.a_plus - prevEnergy;
            prevEnergy = parsed.data.a_plus;
            prevHour = timeAndDate.getHours();
            console.log (prevHourAvgPower);
        }
        parsed.data.prevHourAvgPower = prevHourAvgPower;
        console.log("---------------------------");
        console.log(new Date().toLocaleString());
        console.log(parsed);
        mqtt.publish('energyMeter/data', JSON.stringify(parsed), {retain: false});
    }
    if (prevData.length > 100) {
        prevData = Buffer.alloc(0);
        console.log('Screwed up parse, buffer reset');
    }

})

port.on('error', function (err) {
    console.log('Error: ', err.message)
})

