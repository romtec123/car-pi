#!/bin/bash

# Get the GPS data using gpspipe and redirect errors to /dev/null
gpsdata=$(gpspipe -w -n 10 2>/dev/null | grep -m 1 -Eo '"class":"TPV".*')

# Check if gpsdata is empty
if [ -z "$gpsdata" ]; then
  echo '{
    "error": "No GPS data available"
  }'
  exit 1
fi

# Wrap the gpsdata in curly braces to make it a valid JSON object
gpsdata="{${gpsdata}}"

# Extract latitude, longitude, and speed from the GPS data, redirect errors to /dev/null
latitude=$(echo $gpsdata | jq -r '.lat // empty' 2>/dev/null)
longitude=$(echo $gpsdata | jq -r '.lon // empty' 2>/dev/null)
speed=$(echo $gpsdata | jq -r '.speed // empty' 2>/dev/null)

# Check if the latitude and longitude are empty
if [ -z "$latitude" ] || [ -z "$longitude" ]; then
  echo '{
    "error": "Incomplete GPS data"
  }'
  exit 1
fi

# Convert speed from m/s to km/h, default to 0 if speed is empty
if [ -z "$speed" ]; then
  speed_kmh=0
else
  speed_kmh=$(echo "$speed * 3.6" | bc)
fi

# Create the JSON structure
json_output=$(jq -n \
  --arg lat "$latitude" \
  --arg lon "$longitude" \
  --arg spd "$speed_kmh" \
  --arg typ "GPS" \
  '{
    "location": {
      "lat": ($lat | tonumber),
      "lng": ($lon | tonumber)
    },
    "spd": ($spd | tonumber),
    "type": $typ
  }')

# Print the JSON output
echo "$json_output"
