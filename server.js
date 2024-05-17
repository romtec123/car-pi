/**
 * server.js
 * Listens to heartbeat from raspberry pi and prints data received from it
 */

import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const defaultConfig = {
    port: 3123
};

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configDir = path.join(__dirname, 'config');
const configFilePath = path.join(configDir, 'sv.json');

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
}

// Ensure config file exists, if not create with default config and exit
if (!fs.existsSync(configFilePath)) {
    fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
    console.log(`Default config file created at ${configFilePath}. Please edit the file and restart the server.`);
    process.exit(0);
}

// Read config file
const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

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
