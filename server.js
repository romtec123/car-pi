/**
 * server.js
 * Listens to heartbeat from raspberry pi and prints data received from it
 */

import express from 'express';
import bodyParser from 'body-parser';
import { getConfig } from './configUtil.js'
let stats = {}
const defaultConfig = {
    port: 3123,
    authToken: ""
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
        console.log('Received heartbeat');
        if (data.status) stats.status = data.status
        if (data.timestamp) stats.timestamp = data.timestamp
        if (data.lastOpened && data.lastOpened != -1) stats.lastOpened = new Date(data.lastOpened).toLocaleString('en', {timeZone: 'America/Los_Angeles'})
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
        res.status(200).send('OK')
    } else {
        res.status(401).send('unauthorized');
    }
    
})

app.get('/', (req, res) => {
    let data = "***Car Pi Status***<br>Last Status: "
    data += `${stats.status ?? "n/a"}<br>Last Update: ${stats.timestamp ?? "n/a"}`
    data += `<br>Last Door Open: ${stats.lastOpened ?? "n/a"}`
    res.send(data)
})

app.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
});
