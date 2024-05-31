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

let doorValue = 1; // 1 = Closed, 0 = open
// Function to handle door open/close events
doorSensor.watch((err, value) => {

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

// Clean up on exit
process.on('SIGINT', () => {
    doorSensor.unexport();
    console.log('Exiting...');
    process.exit();
});
