# car-pi
Some scripts and utilities for a raspberry pi that acts as a vehicle alarm system.

In it's current state this project provides a web page and map to monitor the status and position of the vehicle with a door sensor that will notify when the door is opened via a Discord webhook.

The codebase is pretty scattered and unorganized while I prototype, it will be improved at a later time

# Implementation
Inside of a project box, I have the following items:

Raspberry Pi Zero W w/ Waveshare SIM7600G-H 4G HAT

12v battery voltage cutoff to prevent draining my battery

12v -> 3.3v 4 channel opto-isolator board for signalling

12v -> 5v buck converter for power
