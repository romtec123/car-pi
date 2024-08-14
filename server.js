/**
 * server.js
 * Listens to heartbeat and sensor notifications from the client and prints shows received from it
*/

import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { getConfig } from './configUtil.js';
import fetch from 'node-fetch';

let stats = { sensors: [{}, {}, {}, {}] }
const posHistory = []
const defaultConfig = {
    port: 3123,
    authToken: "",
    password: "admin",  // Add a default password
    discordSensorNotif: false,
    discordWebHookURL: "",
};

const app = express();

// Read config file
const config = await getConfig("sv", defaultConfig)

// Middleware to parse JSON, URL-encoded data, and cookies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Add this middleware to handle form submissions
app.use(cookieParser());
app.set('view engine', 'ejs');

// Middleware to check if the user is authenticated for the web pages
function isAuthenticated(req, res, next) {
    const { carPiKey } = req.cookies; // Check for the carPiKey cookie

    if (carPiKey === config.password) {
        return next();
    }

    res.redirect('/login');
}

// Login endpoint
app.get('/login', (req, res) => {
    res.send(`
        <form method="POST" action="/login">
            <label for="password">Password:</label>
            <input type="password" name="password" id="password" required>
            <button type="submit">Login</button>
        </form>
    `);
});

app.post('/login', (req, res) => {
    const { password } = req.body;

    if (password === config.password) {
        res.cookie('carPiKey', password, { httpOnly: true }); // Set the carPiKey cookie
        return res.redirect('/');
    }

    res.status(401).send('Unauthorized: Incorrect password');
});

// Protect the root and map endpoints
app.get('/', isAuthenticated, (req, res) => {
    let data = "***Car Pi Status***<br>Last Status: "
    data += `${stats.status ?? "n/a"}<br>Last Update: ${stats.timestamp ?? "n/a"}`
    data += `<br>Door Open: ${!isNaN(stats.sensors[0].doorValue) && stats.sensors[0].doorValue == 0 ? "Yes" : "No"}<br>Last Door Open: ${stats.lastOpened ?? "n/a"}<br>`
    data += `CPU Temp: ${stats.lastTemp ?? "n/a"}<br>`

    if (stats.position) {
        data += `Speed: ${getSpeedMPH(stats.position.spd)} mph<br>`
        if (req.query.showPos == "true") data += `Position: ${stats.position.lat}, ${stats.position.lng}<br>`
        else data += `<a href="/?showPos=true">Show Position</a><br>`
    }

    data += '<meta http-equiv="refresh" content="30">'
    res.send(data)
});

app.get('/map', isAuthenticated, (req, res) => {
    res.render('map', { posHistory });
});

// API endpoints (do not require the cookie-based authentication)
app.post('/api/heartbeat', (req, res) => {
    const dataArray = req.body;

    // Ensure the payload is an array to handle cached data
    if (!Array.isArray(dataArray)) {
        return res.status(400).send('Bad Request: Expected an array of heartbeats.');
    }

    let unauthorized = false;

    dataArray.forEach(data => {
        if (data.authToken !== config.authToken) {
            unauthorized = true;
            return;
        }

        if (data.status) stats.status = data.status;
        if (data.timestamp) stats.timestamp = data.timestamp;
        if (data.lastOpened && data.lastOpened != -1) stats.lastOpened = new Date(data.lastOpened).toLocaleString('en', { timeZone: 'America/Los_Angeles' });
        if (data.temp) stats.lastTemp = data.temp;
        if (data.position && !isNaN(data.position.lat)) {
            let distance = -1;
            if (posHistory.length > 0) {
                distance = calculateDistance(posHistory[posHistory.length - 1].position.lat, posHistory[posHistory.length - 1].position.lng, data.position.lat, data.position.lng);
            }
            console.log(distance)
            if (posHistory.length < 1 || distance > 100) { // add to history if initial value or 100ft away from last position
                posHistory.push({ time: Date.now(), position: data.position });
                if (posHistory.length > 1000) posHistory.shift();
            }
            stats.position = data.position; // keep this more up to date than history
            console.log(posHistory.length)
        }
    });

    if (unauthorized) {
        return res.status(401).send('unauthorized');
    }

    res.status(200).send('Heartbeat(s) received');
});

app.post('/api/sensorActivate', (req, res) => {
    const data = req.body;

    if (data.authToken === config.authToken) {
        console.log(`Door sensor triggered! time: ${new Date().toLocaleString('en', { timeZone: 'America/Los_Angeles' })}`)
        console.log(data)
        if (data.lastOpened && data.lastOpened != -1) stats.lastOpened = new Date(data.lastOpened).toLocaleString('en', { timeZone: 'America/Los_Angeles' })
        if (data.sensorID && !isNaN(data.doorValue)) {
            stats.sensors[data.sensorID - 1].doorValue = data.doorValue
        }
        if (config.discordSensorNotif) {
            let dt = Date.now()
            let ts = Math.round(dt / 1000)
            sendDiscordNotif(`Sensor ID \`${data.sensorID}\` is now \`${!isNaN(data.doorValue) && data.doorValue == 0 ? "OPEN" : "CLOSED"}\`\n<t:${ts}:R> <t:${ts}:f> [${dt}]`)
        }
        res.status(200).send('OK')
    } else {
        res.status(401).send('unauthorized');
    }
})

app.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
});

async function sendDiscordNotif(msg) {
    if (!msg) return;
    try {
        let response = await fetch(config.discordWebHookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'Car Door Watchdog',
                content:
                  `@everyone\n***DOOR SENSOR TRIGGERED***\nMessage: ${msg}`,
            }),
        }).catch(err => console.log('Could not POST sensor activation:', err));

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

    } catch (error) {
        console.error('Error sending sensor activation:', error);
    }

}

function getSpeedMPH(speedKMH) {
    if (isNaN(speedKMH)) return "N/A"
    return (speedKMH * 0.621371).toFixed(1);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const earthRadius = 20902231.98757;  // Earth's radius in feet
    const toRadians = Math.PI / 180.0;
    const dLat = (lat2 - lat1) * toRadians;  // Latitude difference in radians
    const dLon = (lon2 - lon1) * toRadians;  // Longitude difference in radians

    // Haversine formula to calculate distance 
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;

    return distance;
}
