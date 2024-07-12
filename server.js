/**
 * server.js
 * Listens to heartbeat and sensor notifications from the client and prints shows received from it
*/

import express from 'express';
import bodyParser from 'body-parser';
import { getConfig } from './configUtil.js'
import fetch from 'node-fetch';

let stats = {sensors: [{}, {}, {}, {}]}
let posHistory = [] //memory leak
const defaultConfig = {
    port: 3123,
    authToken: "",
    discordSensorNotif: false,
    discordWebHookURL: "",
};

const app = express();


// Read config file
const config = await getConfig("sv", defaultConfig)

// Middleware to parse JSON
app.use(bodyParser.json());

// Heartbeat endpoint
app.post('/api/heartbeat', (req, res) => {
    const data = req.body;
    if(data.authToken === config.authToken){
        if (data.status) stats.status = data.status;
        if (data.timestamp) stats.timestamp = data.timestamp;
        if (data.lastOpened && data.lastOpened != -1) stats.lastOpened = new Date(data.lastOpened).toLocaleString('en', {timeZone: 'America/Los_Angeles'});
        if(data.temp) stats.lastTemp = data.temp;
        if(data.position && !isNaN(data.position.lat)){
            posHistory.push({time: Date.now(), position: data.position});
            if(posHistory.length > 1000) posHistory.shift();
            stats.position = data.position;
        } 
        res.status(200).send('Heartbeat received');
    } else {
        res.status(401).send('unauthorized');
    }
});

app.post('/api/sensorActivate', (req, res) => {
    const data = req.body;

    if(data.authToken === config.authToken){
        console.log(`Door sensor triggered! time: ${new Date().toLocaleString('en', {timeZone: 'America/Los_Angeles'})}`)
        console.log(data)
        if (data.lastOpened && data.lastOpened != -1) stats.lastOpened = new Date(data.lastOpened).toLocaleString('en', {timeZone: 'America/Los_Angeles'})
        if (data.sensorID && !isNaN(data.doorValue)) {
            stats.sensors[data.sensorID-1].doorValue = data.doorValue
        }
        if (config.discordSensorNotif) {
            let ts = Math.round(Date.now()/1000)
            sendDiscordNotif(`Sensor ID \`${data.sensorID}\` is now \`${!isNaN(data.doorValue) && data.doorValue == 0 ? "OPEN" : "CLOSED"}\`\n<t:${ts}:R> <t:${ts}:f>`)
        }
        res.status(200).send('OK')
    } else {
        res.status(401).send('unauthorized');
    }
    
})

app.get('/', (req, res) => {
    let data = "***Car Pi Status***<br>Last Status: "
    data += `${stats.status ?? "n/a"}<br>Last Update: ${stats.timestamp ?? "n/a"}`
    data += `<br>Door Open: ${!isNaN(stats.sensors[0].doorValue) && stats.sensors[0].doorValue == 0 ? "Yes" : "No"}<br>Last Door Open: ${stats.lastOpened ?? "n/a"}<br>`
    data += `CPU Temp: ${stats.lastTemp ?? "n/a"}<br>`

    if(stats.position) {
        data += `Speed: ${getSpeedMPH(stats.position.spd)} mph<br>`
        if(req.query.showPos == "true") data += `Position: ${stats.position.lat}, ${stats.position.lng}<br>`
        else data += `<a href="/?showPos=true">Show Position</a><br>`
    }
    
    data += '<meta http-equiv="refresh" content="30">'
    res.send(data)
})

app.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
});


async function sendDiscordNotif(msg) {
    if(!msg) return;
    try {
        let response = await fetch(config.discordWebHookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // the username to be displayed
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
    if(isNaN(speedKMH)) return "N/A"
    return (speedKMH * 0.621371).toFixed(1);
}