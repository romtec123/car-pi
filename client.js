/**
 * client.js
 * Sends heartbeat sensor notifications to the server and caches GPS data
 */
import fs from 'fs';
import fetch from 'node-fetch';
import os from 'os';
import { Gpio } from 'onoff';
import { getConfig } from './configUtil.js';

let lastOpened = -1;
let positionHistory = [];
let defaultConfig = {
    authToken: "",
    serverUrl: 'http://localhost:3123',
    gpsFilePath: "/tmp/locGPS",
    tempPath: '/sys/class/thermal/thermal_zone0/temp',
    positionCachePath: '/tmp/positionCache.json',
    heartbeatTimerMS: 60000,
    updatePositionInterval: 15000,
    deBounceWait: 100,
    gpioPin1: 529,
    gpioPin2: 539,
    gpioPin3: 534,
    gpioPin4: 535,
    lowDataMode: false,
};

const config = await getConfig("cl", defaultConfig);

// Prevent calling onoff on dev env
let useGpio = true;
if (os.platform() == "win32" || os.platform() == "darwin") useGpio = false;

if (useGpio) {
    var sensor1 = new Gpio(config.gpioPin1, 'in', 'both'); 
    var sensor2 = new Gpio(config.gpioPin2, 'in', 'both');
    var sensor3 = new Gpio(config.gpioPin3, 'in', 'both'); 
    var sensor4 = new Gpio(config.gpioPin4, 'in', 'both'); 

    var doorValue = 1;
    sensor1.watch((err, value) => {
        if (err) {
            console.error('Error reading GPIO pin:', err);
            return;
        }
        if (value == 1) {
            if (doorValue == 0) {
                doorValue = 1;
                lastOpened = Date.now();
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

// Calculate distance between two coordinates using the Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const earthRadius = 20902231.98757;  // Earth's radius in feet
    const toRadians = Math.PI / 180.0;
    const dLat = (lat2 - lat1) * toRadians;
    const dLon = (lon2 - lon1) * toRadians;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;

    return distance;
}

// Cache the position if it's valid and more than 100ft from the last position
function cachePosition() {
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

    // Check for invalid data
    if (position.lat === 'N/A' || position.lng === 'N/A') {
        console.log('Invalid position data, not caching:', position);
        return;
    }

    if (positionHistory.length > 0) {
        const lastPosition = positionHistory[positionHistory.length - 1];
        const distance = calculateDistance(lastPosition.lat, lastPosition.lng, position.lat, position.lng);
        
        if (distance < 100) {
            console.log('Position too close to last position, not caching:', distance, 'feet');
            return;
        }
    }

    positionHistory.push(position);
    console.log('Position cached:', position);

    if (positionHistory.length > 1000) positionHistory.shift();

    try {
        fs.writeFileSync(config.positionCachePath, JSON.stringify(positionHistory), 'utf8');
    } catch (err) {
        console.error('Error writing to position cache file:', err);
    }
}

async function sendHeartbeat() {
    let temp = 0;
    if (fs.existsSync(config.tempPath)) { 
        try {
            const tempDataRaw = fs.readFileSync(config.tempPath, 'utf8');
            temp = parseFloat(tempDataRaw) / 1000;
        } catch (err) {
            console.error('Error reading CPU temperature:', err);
        }
    }

    // Load position history from cache
    if (fs.existsSync(config.positionCachePath)) {
        try {
            const cacheRaw = fs.readFileSync(config.positionCachePath, 'utf8');
            positionHistory = JSON.parse(cacheRaw);
        } catch (err) {
            console.error('Error reading position cache file:', err);
        }
    }

    const statistics = {
        authToken: config.authToken,
        timestamp: config.lowDataMode ? Date.now() : new Date().toLocaleString('en', { timeZone: 'America/Los_Angeles' }),
        status: 'ALIVE',
        doorValue: isNaN(doorValue) ? "Unknown" : doorValue,
        positions: positionHistory, // Send the cached positions
        temp: temp, // Always send temperature
    };

    try {
        const response = await fetch(config.serverUrl + "/api/heartbeat", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(statistics)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        // Clear the position history after successful transmission
        positionHistory = [];
        if (fs.existsSync(config.positionCachePath)) {
            fs.unlinkSync(config.positionCachePath);
        }

    } catch (error) {
        console.error('Error sending heartbeat, will retry later:', error);
    }
}

// Set the interval for updating the position
setInterval(cachePosition, config.updatePositionInterval);

// Set the interval for sending the heartbeat
const heartbeatInterval = config.lowDataMode ? config.heartbeatTimerMS * 4 : config.heartbeatTimerMS;
setInterval(sendHeartbeat, heartbeatInterval);

async function sendSensorAlert(data) {
    if (!data || !data.sensorID || !data.authToken) return;

    try {
        const response = await fetch(config.serverUrl + "/api/sensorActivate", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

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
            body: JSON.stringify([shutdownData])
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

    } catch (error) {
        console.error('Error sending shutdown heartbeat:', error);
    }

    console.log('Exiting...');
    process.exit();
};
