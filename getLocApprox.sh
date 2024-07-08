#!/bin/bash
#This script gets your approximate location using WiFi networks
#Add your Google maps API Key below:
KEY=
sudo iwlist wlan0 scan | awk '
BEGIN {
    print "{\"wifiAccessPoints\":["
    first = 1
}
/^ *Cell/ {
    if (!first) {
        print "},"
    }
    first = 0
    printf "{\"macAddress\":\"" $5 "\","
}
/^ *Quality/ {
    split($0, arr, "=")
    split(arr[3], signal, " ")
    signalStrength = -signal[1]
    printf "\"signalStrength\":" signalStrength
}
END {
    print "}]}"
}' | curl -d @- -H "Content-Type: application/json" "https://www.googleapis.com/geolocation/v1/geolocate?key=$KEY"