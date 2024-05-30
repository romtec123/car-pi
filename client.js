import fetch from 'node-fetch';
import { getConfig } from './configUtil.js'

// Configuration file setup
const defaultConfig = {
    serverUrl: 'http://localhost:3123/heartbeat',
};

const config = await getConfig("cl", defaultConfig)

console.log(config)
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
