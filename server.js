/**
 * server.js
 * Listens to heartbeat from raspberry pi and prints data received from it
 */

import express from 'express';
import bodyParser from 'body-parser';
import { getConfig } from './configUtil.js'

const defaultConfig = {
    port: 3123
};

const app = express();


// Read config file
const config = await getConfig("sv", defaultConfig)

// Middleware to parse JSON
app.use(bodyParser.json());

// Heartbeat endpoint
app.post('/heartbeat', (req, res) => {
    const data = req.body;
    console.log('Received heartbeat:', data);
    res.status(200).send('Heartbeat received');
});

app.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
});
