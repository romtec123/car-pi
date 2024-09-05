/**
 * server.js
 * Listens to heartbeat and sensor notifications from the client and handles the data appropriately.
 */

import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { getConfig } from './configUtil.js';
import fetch from 'node-fetch';

let stats = { sensors: [{}, {}, {}, {}] };
const posHistory = [];
const defaultConfig = {
    port: 3123,
    authToken: "",
    password: "admin",  // Add a default password
    discordSensorNotif: false,
    discordWebHookURL: "",
};

const app = express();
app.use(express.static('public'));

// Read config file
const config = await getConfig("sv", defaultConfig);

// Middleware to parse JSON, URL-encoded data, and cookies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
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
    res.render('login', { authenticated: false });
});

app.post('/login', (req, res) => {
    const { password } = req.body;

    if (password === config.password) {
        res.cookie('carPiKey', password, { httpOnly: true }); // Set the carPiKey cookie
        return res.redirect('/');
    }

    res.status(401).send('Unauthorized: Incorrect password');
});

// Logout endpoint
app.get('/logout', (req, res) => {
    res.clearCookie('carPiKey'); // Remove the authentication cookie
    res.redirect('/login');      // Redirect to the login page
});

// Home page (protected by authentication)
app.get('/', isAuthenticated, (req, res) => {
    const homeData = {
        status: stats.status ?? "n/a",
        timestamp: stats.timestamp ?? "n/a",
        doorValue: !isNaN(stats.sensors[0].doorValue) && stats.sensors[0].doorValue == 0 ? "Yes" : "No",
        lastOpened: stats.lastOpened ?? "n/a",
        lastTemp: stats.lastTemp ?? "n/a",
        speed: stats.position ? getSpeedMPH(stats.position.spd) : "N/A",
        position: stats.position ?? null,
        showPos: req.query.showPos === "true",
    };
    res.render('home', { homeData, authenticated: true });
});

// Map page (protected by authentication)
app.get('/map', isAuthenticated, (req, res) => {
    res.render('map', { posHistory, currentPos: posHistory[posHistory.length - 1], authenticated: true });
});

// API endpoints (do not require the cookie-based authentication)
app.post('/api/heartbeat', (req, res) => {
    const data = req.body;

    console.log("Received heartbeat data:", data);

    if (data.authToken !== config.authToken) {
        console.error("Unauthorized access attempt with authToken:", data.authToken);
        return res.status(401).send('unauthorized');
    }

    if (data.status) stats.status = data.status;
    if (data.timestamp) stats.timestamp = data.timestamp;
    if (data.lastOpened && data.lastOpened != -1) stats.lastOpened = new Date(data.lastOpened).toLocaleString('en', { timeZone: 'America/Los_Angeles' });
    if (data.temp) stats.lastTemp = data.temp;

    if (data.positions && Array.isArray(data.positions)) {
        data.positions.forEach(position => {
            if (!isNaN(position.lat)) {
                posHistory.push({ time: Date.now(), position });
                if (posHistory.length > 1000) posHistory.shift();
                stats.position = position; // Keep this more up to date than history
                console.log("Position history length:", posHistory.length);
            }
        });
    }

    res.status(200).send('Heartbeat received');
});

app.post('/api/sensorActivate', (req, res) => {
    const data = req.body;

    console.log("Received sensor activation data:", data);

    if (data.authToken === config.authToken) {
        console.log(`Door sensor triggered! time: ${new Date().toLocaleString('en', { timeZone: 'America/Los_Angeles' })}`);
        console.log("Sensor data:", data);

        if (data.lastOpened && data.lastOpened != -1) stats.lastOpened = new Date(data.lastOpened).toLocaleString('en', { timeZone: 'America/Los_Angeles' });
        if (data.sensorID && !isNaN(data.doorValue)) {
            stats.sensors[data.sensorID - 1].doorValue = data.doorValue;
        }
        if (config.discordSensorNotif) {
            let dt = Date.now();
            let ts = Math.round(dt / 1000);
            sendDiscordNotif(`Sensor ID \`${data.sensorID}\` is now \`${!isNaN(data.doorValue) && data.doorValue == 0 ? "OPEN" : "CLOSED"}\`\n<t:${ts}:R> <t:${ts}:f> [${dt}]`);
        }
        res.status(200).send('OK');
    } else {
        console.error("Unauthorized access attempt with authToken:", data.authToken);
        res.status(401).send('unauthorized');
    }
});

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
