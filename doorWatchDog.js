import { Gpio } from 'onoff';
import { getConfig } from './configUtil.js'

let defaultConfig = {
    webHookURL: "",
    deBounceWait: 100,
    gpioPin1: 529,
    gpioPin2: 539,
    gpioPin3: 534,
    gpioPin4: 535,
}
// gpio pin numbers based on output from: cat /sys/kernel/debug/gpio

const config = await getConfig("dw", defaultConfig)

const doorSensor1 = new Gpio(config.gpioPin1, 'in', 'both'); // GPIO pin 11, Door sensor.
const doorSensor2 = new Gpio(config.gpioPin2, 'in', 'both'); // GPIO pin 13
const doorSensor3 = new Gpio(config.gpioPin3, 'in', 'both'); // GPIO pin 15
const doorSensor4 = new Gpio(config.gpioPin4, 'in', 'both'); // GPIO pin 16
// Watching for any change on the pin, i am a using an optocoupler with the 12v door switch circut


let doorValue = 1; // 1 = Closed, 0 = open
// Function to handle door open/close events
doorSensor1.watch((err, value) => {

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
