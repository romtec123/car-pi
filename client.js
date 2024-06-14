/**
 * client.js
 * Sends heartbeat sensor notifications to the server
*/
import fs from 'fs';
import fetch from 'node-fetch';
import os from 'os';
import { Gpio } from 'onoff';
import { getConfig } from './configUtil.js';
const tempPath = '/sys/class/thermal/thermal_zone0/temp';

let lastOpened = -1;
let defaultConfig = {
    authToken: "",
    serverUrl: 'http://localhost:3123',
    deBounceWait: 100,
    gpioPin1: 529,
    gpioPin2: 539,
    gpioPin3: 534,
    gpioPin4: 535,
}
// gpio pin numbers based on output from: cat /sys/kernel/debug/gpio

const config = await getConfig("cl", defaultConfig)

//Prevent calling onoff on dev env
let useGpio = true;
if(os.platform() == "win32" || os.platform() == "darwin") useGpio = false

if(useGpio) {
    var sensor1 = new Gpio(config.gpioPin1, 'in', 'both'); // GPIO pin 11, Door sensor.
    var sensor2 = new Gpio(config.gpioPin2, 'in', 'both'); // GPIO pin 13
    var sensor3 = new Gpio(config.gpioPin3, 'in', 'both'); // GPIO pin 15
    var sensor4 = new Gpio(config.gpioPin4, 'in', 'both'); // GPIO pin 16

    var doorValue = 1; // 1 = Closed, 0 = open
    // Function to handle door open/close events
    sensor1.watch((err, value) => {

        if (err) {
            console.error('Error reading GPIO pin:', err);
            return;
        }

        if (value == 1) {

            if(doorValue == 0){
                doorValue = 1
                console.log("Door closed! time: " + new Date().toLocaleString('en', {timeZone: 'America/Los_Angeles'}))
                sendSensorAlert({authToken: config.authToken, sensorID: 1, doorValue, lastOpened, msg: "Door closed"})
            }

        } else {

            if(doorValue == 1) {
                doorValue = 0
                lastOpened = Date.now()
                console.log("Door opened! time: " + new Date().toLocaleString('en', {timeZone: 'America/Los_Angeles'}))
                sendSensorAlert({authToken: config.authToken, sensorID: 1, doorValue, lastOpened, msg: "Door opened"})
            }

        }

    });
}



async function sendHeartbeat() {
    let temp = 0
    if(fs.existsSync(tempPath)) {
        const tempDataRaw = fs.readFileSync(tempPath, 'utf8');
        temp = parseFloat(tempDataRaw) / 1000;
    }
    const statistics = {
        authToken: config.authToken,
        timestamp: new Date().toLocaleString('en', {timeZone: 'America/Los_Angeles'}),
        status: 'ALIVE',
        doorValue: isNaN(doorValue) ? "Unknown" : doorValue,
        lastOpened,
        temp,
        
    };

    try {
        const response = await fetch(config.serverUrl + "/api/heartbeat", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(statistics)
        }).catch(err => console.log('Could not POST heartbeat:', err));

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }
    
}

// Call the function to send the heartbeat
setInterval(sendHeartbeat, 30000)


async function sendSensorAlert(data) {
    if(!data) return
    if(!data.sensorID) return
    if(!data.authToken) return

    try {
        const response = await fetch(config.serverUrl + "/api/sensorActivate", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(err => console.log('Could not POST sensor activation:', err));

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }

}


// Clean up on exit
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
    if(useGpio) {
        sensor1.unexport();
        sensor2.unexport();
        sensor3.unexport();
        sensor4.unexport();
    }

    const shutdownData = {
        authToken: config.authToken,
        timestamp: new Date().toLocaleString('en', {timeZone: 'America/Los_Angeles'}),
        status: 'SHUTTING DOWN',
    };

    try {
        const response = await fetch(config.serverUrl + "/api/heartbeat", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(shutdownData)
        }).catch(err => console.log('Could not POST heartbeat:', err));

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }
    
    console.log('Exiting...');
    process.exit();
};
