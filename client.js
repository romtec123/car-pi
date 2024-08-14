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
const cacheFilePath = '/tmp/heartbeatCache.json';

let lastOpened = -1;
let defaultConfig = {
    authToken: "",
    serverUrl: 'http://localhost:3123',
    gpsFilePath: "/tmp/locGPS",
    heartbeatTimerMS: 60000,
    deBounceWait: 100,
    gpioPin1: 529,
    gpioPin2: 539,
    gpioPin3: 534,
    gpioPin4: 535,
};
// gpio pin numbers based on output from: cat /sys/kernel/debug/gpio

const config = await getConfig("cl", defaultConfig);

// Prevent calling onoff on dev env
let useGpio = true;
if (os.platform() == "win32" || os.platform() == "darwin") useGpio = false;

if (useGpio) {
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

            if (doorValue == 0) {
                doorValue = 1;
                console.log("Door closed! time: " + new Date().toLocaleString('en', { timeZone: 'America/Los_Angeles' }));
                sendSensorAlert({ authToken: config.authToken, sensorID: 1, doorValue, lastOpened, msg: "Door closed" });
            }

        } else {

            if (doorValue == 1) {
                doorValue = 0;
                lastOpened = Date.now();
                console.log("Door opened! time: " + new Date().toLocaleString('en', { timeZone: 'America/Los_Angeles' }));
                sendSensorAlert({ authToken: config.authToken, sensorID: 1, doorValue, lastOpened, msg: "Door opened" });
            }

        }

    });
}

function cacheData(data) {
    let cachedData = [];

    if (fs.existsSync(cacheFilePath)) {
        try {
            const cacheRaw = fs.readFileSync(cacheFilePath, 'utf8');
            cachedData = JSON.parse(cacheRaw);
        } catch (err) {
            console.error('Error reading or parsing cache file:', err);
            cachedData = []; // Reset to an empty array if the cache is corrupted
        }
    }

    cachedData.push(data);

    try {
        fs.writeFileSync(cacheFilePath, JSON.stringify(cachedData), 'utf8');
    } catch (err) {
        console.error('Error writing to cache file:', err);
    }
}

async function sendDataWithCache(data, endpoint) {
    const url = config.serverUrl + endpoint;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        // If the data is successfully sent, try sending cached data
        if (fs.existsSync(cacheFilePath)) {
            try {
                const cacheRaw = fs.readFileSync(cacheFilePath, 'utf8');
                const cachedData = JSON.parse(cacheRaw);

                for (const cachedItem of cachedData) {
                    await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(cachedItem)
                    });
                }

                // Clear cache after successful transmission
                fs.unlinkSync(cacheFilePath);
            } catch (err) {
                console.error('Error processing cached data:', err);
            }
        }

    } catch (err) {
        console.log('Network error, caching data:', err);
        try {
            cacheData(data);
        } catch (cacheErr) {
            console.error('Error caching data:', cacheErr);
        }
    }
}

async function sendHeartbeat() {
    let temp = 0;
    if (fs.existsSync(tempPath)) {
        try {
            const tempDataRaw = fs.readFileSync(tempPath, 'utf8');
            temp = parseFloat(tempDataRaw) / 1000;
        } catch (err) {
            console.error('Error reading CPU temperature:', err);
        }
    }

    let position = { lat: "N/A", lng: "N/A", spd: "N/A" };
    if (fs.existsSync(config.gpsFilePath)) {
        try {
            const tempGPSRaw = fs.readFileSync(config.gpsFilePath, 'utf8');
            const gpsData = JSON.parse(tempGPSRaw);

            if (!gpsData.error && gpsData.location) {
                position = {
                    lat: gpsData.location.lat ?? "N/A",
                    lng: gpsData.location.lng ?? "N/A",
                    spd: gpsData.spd ?? "N/A"
                };
            }
        } catch (err) {
            console.error('Error reading or parsing GPS data:', err);
        }
    }

    const statistics = {
        authToken: config.authToken,
        timestamp: new Date().toLocaleString('en', { timeZone: 'America/Los_Angeles' }),
        status: 'ALIVE',
        doorValue: isNaN(doorValue) ? "Unknown" : doorValue,
        lastOpened,
        temp,
        position,
    };

    try {
        await sendDataWithCache(statistics, "/api/heartbeat");
    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }
}

// Call the function to send the heartbeat
setInterval(sendHeartbeat, config.heartbeatTimerMS);

async function sendSensorAlert(data) {
    if (!data || !data.sensorID || !data.authToken) return;

    try {
        await sendDataWithCache(data, "/api/sensorActivate");
    } catch (error) {
        console.error('Error sending sensor alert:', error);
    }
}

// Clean up on exit
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
    if (useGpio) {
        sensor1.unexport();
        sensor2.unexport();
        sensor3.unexport();
        sensor4.unexport();
    }

    const shutdownData = {
        authToken: config.authToken,
        timestamp: new Date().toLocaleString('en', { timeZone: 'America/Los_Angeles' }),
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
        console.error('Error sending shutdown heartbeat:', error);
    }

    console.log('Exiting...');
    process.exit();
};

// Send cached data on startup
(async () => {
    if (fs.existsSync(cacheFilePath)) {
        try {
            const cacheRaw = fs.readFileSync(cacheFilePath, 'utf8');
            const cachedData = JSON.parse(cacheRaw);

            for (const cachedItem of cachedData) {
                await sendDataWithCache(cachedItem, cachedItem.endpoint || "/api/heartbeat");
            }

            fs.unlinkSync(cacheFilePath);
        } catch (err) {
            console.error('Error processing startup cache:', err);
        }
    }
})();
