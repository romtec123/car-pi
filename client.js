import fetch from 'node-fetch';
import os from 'os';
import { Gpio } from 'onoff';
import { getConfig } from './configUtil.js';

let defaultConfig = {
    webHookURL: "",
    serverUrl: 'http://localhost:3123/heartbeat',
    deBounceWait: 100,
    gpioPin1: 529,
    gpioPin2: 539,
    gpioPin3: 534,
    gpioPin4: 535,
}
// gpio pin numbers based on output from: cat /sys/kernel/debug/gpio

const config = await getConfig("cl", defaultConfig)

//Prevent calling onoff on dev env
let noGpio = false;
if(os.platform() == "win32" || os.platform() == "darwin") noGpio = true

if(!noGpio) {
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

            if(doorValue == 0){
                doorValue = 1
                console.log("Door closed!" + new Date())
            }

        } else {

            if(doorValue == 1) {
                doorValue = 0
                console.log("Door Opened! Time: " + new Date())
            }

        }

    });
}





async function sendHeartbeat() {
    const statistics = {
        // Replace this with actual statistics
        timestamp: new Date(),
        status: 'ALIVE',
        doorValue: isNaN(doorValue) ? "Unknown" : doorValue,
        
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
setInterval(sendHeartbeat, 30000)


// Clean up on exit
process.on('SIGINT', () => {
    if(!noGpio) {
        sensor1.unexport();
        sensor2.unexport();
        sensor3.unexport();
        sensor4.unexport();
    }
    
    console.log('Exiting...');
    process.exit();
});
