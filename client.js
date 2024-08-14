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
    lowDataMode: false,  // Added lowDataMode configuration
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

    // Remove authToken before caching
    const { authToken, ...dataWithoutToken } = data;
    cachedData.push(dataWithoutToken);

    try {
        fs.writeFileSync(cacheFilePath, JSON.stringify(cachedData), 'utf8');
    } catch (err) {
        console.error('Error writing to cache file:', err);
    }
}

async function sendDataWithCache(data, endpoint) {
    const url = config.serverUrl + endpoint;

    // Ensure the authToken is included from config
    data.authToken = config.authToken;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([data]) // Wrap in array to ensure format consistency
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        // If the data is successfully sent, try sending cached data in a single request
        if (fs.existsSync(cacheFilePath)) {
            try {
                const cacheRaw = fs.readFileSync(cacheFilePath, 'utf8');
                const cachedData = JSON.parse(cacheRaw);

                if (cachedData.length > 0) {
                    // Add authToken to each cached item before sending
                    const cachedDataWithToken = cachedData.map(item => ({
                        ...item,
                        authToken: config.authToken
                    }));

                    const cacheResponse = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(cachedDataWithToken)
                    });

                    if (cacheResponse.ok) {
                        // Clear cache after successful transmission
                        fs.unlinkSync(cacheFilePath);
                    } else {
                        throw new Error(`Server error: ${cacheResponse.statusText}`);
                    }
                }
            } catch (err) {
                console.error('Error processing cached data:', err);
            }
        }

    } catch (err) {
        console.log('Network error, caching data:', err);
        try {
            cacheData(data);  // Cache the data without the authToken
        } catch (cacheErr) {
            console.error('Error caching data:', cacheErr);
        }
    }
}

async function sendHeartbeat() {
    let temp = 0;
    if (!config.lowDataMode && fs.existsSync(tempPath)) { // Only read temp if not in lowDataMode
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

    // Prepare the statistics object, reduce the size in lowDataMode
    const statistics = {
        authToken: config.authToken,
        timestamp: config.lowDataMode ? Date.now() : new Date().toLocaleString('en', { timeZone: 'America/Los_Angeles' }),
        status: 'ALIVE',
        doorValue: isNaN(doorValue) ? "Unknown" : doorValue,
        position: position, // Always send position
        temp: config.lowDataMode ? undefined : temp, // Remove temp in lowDataMode
    };

    try {
        await sendDataWithCache(statistics, "/api/heartbeat");
    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }
}

// Call the function to send the heartbeat
setInterval(sendHeartbeat, config.lowDataMode ? config.heartbeatTimerMS * 2 : config.heartbeatTimerMS); // Increase interval in lowDataMode

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
        timestamp: config.lowDataMode ? Date.now() : new Date().toLocaleString('en', { timeZone: 'America/Los_Angeles' }),
        status: 'SHUTTING DOWN',
    };

    try {
        const response = await fetch(config.serverUrl + "/api/heartbeat", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([shutdownData]) // Wrap in array to ensure format consistency
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

            if (cachedData.length > 0) {
                const cacheResponse = await fetch(config.serverUrl + "/api/heartbeat", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cachedData)
                });

                if (cacheResponse.ok) {
                    // Clear cache after successful transmission
                    fs.unlinkSync(cacheFilePath);
                } else {
                    throw new Error(`Server error: ${cacheResponse.statusText}`);
                }
            }
        } catch (err) {
            console.error('Error processing startup cache:', err);
        }
    }
})();
