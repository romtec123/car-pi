#!/bin/bash

# This script gets your approximate location using WiFi networks
# Add your Google Maps API Key below:
KEY=

# Check if the API key is set
if [ -z "$KEY" ]; then
  echo '{
    "error": "API key not set"
}'
  exit 1
fi

# Scan for WiFi networks and format the output as JSON
wifi_json=$(sudo iwlist wlan0 scan 2>/dev/null | awk '
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
}')

# Check if the WiFi JSON data is empty or contains no access points
if [ -z "$wifi_json" ] || [[ "$wifi_json" == *'{"wifiAccessPoints":[]}'* ]]; then
  echo '{
    "error": "No WiFi data available"
}'
  exit 1
fi

# Send the WiFi data to Google's Geolocation API
location_data=$(echo "$wifi_json" | curl -s -d @- -H "Content-Type: application/json" "https://www.googleapis.com/geolocation/v1/geolocate?key=$KEY")

# Check if the location data is empty
if [ -z "$location_data" ]; then
  echo '{
    "error": "No location data available"
}'
  exit 1
fi

# Print the location data
echo "$location_data"
