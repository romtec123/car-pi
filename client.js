import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration file setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configDir = path.join(__dirname, 'config');
const configFilePath = path.join(configDir, 'cl.json');
const defaultConfig = {
    serverUrl: 'http://localhost:3123/heartbeat',
};

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
}

// Ensure config file exists, if not create with default config and exit
if (!fs.existsSync(configFilePath)) {
    fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
    console.log(`Default config file created at ${configFilePath}. Please edit the file and restart the client.`);
    process.exit(0);
}

// Read config file
const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));


async function sendHeartbeat() {
    const statistics = {
        // Replace this with actual statistics
        timestamp: new Date(),
        status: 'ALIVE',
    };

    try {
        const response = await fetch(config.serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(statistics)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        const data = await response.text();
        console.log('Server response:', data);
    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }
}

// Call the function to send the heartbeat
sendHeartbeat();
