import { Gpio } from 'onoff';
import { getConfig } from './configUtil.js'

let defaultConfig = {
    webHookURL: "",
    deBounceWait: 500,
    gpioPin: 529,
}

const config = await getConfig("dw", defaultConfig)

const doorSensor = new Gpio(config.gpioPin, 'in', 'both'); // GPIO pin 17, change as needed.
// Watching for any change on the pin, i am a using an optocoupler with the 12v door switch circut



let doorOpened = false;
// Function to handle door open/close events
doorSensor.watch((err, value) => {
    if (err) {
        console.error('Error reading GPIO pin:', err);
        return;
    }

    if(doorOpened) return;

    doorOpened = true
    console.log("Door opened! value: " + value + " Date: " + new Date());
    setTimeout(() => {
        doorOpened = false
    }, config.deBounceWait)
});

// Clean up on exit
process.on('SIGINT', () => {
    doorSensor.unexport();
    console.log('Exiting...');
    process.exit();
});
