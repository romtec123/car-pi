#!/bin/bash
#Simple install script for brand new images

#Update packages & install new ones
echo "Updating and installing packages..."

sudo apt update -y && sudo apt upgrade -y
sudo apt install -y git curl neofetch btop htop nodejs npm cmake raspberrypi-kernel-headers lsb-release dkms rfkill bc fswebcam ffmpeg v4l-utils

# Install tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Change node version
echo "Setting NodeJS version to 18."

sudo npm i -g n
sudo n 18

echo "Node is now version 18."

#Download car-pi repo
git clone https://github.com/romtec123/car-pi

# Install wifi adapter drivers
echo "Downloading WiFi adapter drivers."

git clone https://github.com/morrownr/8821au-20210708.git


echo "Installation finished!"

echo "Disable built in wifi by modifying /boot/firmware/config.txt"
echo "Authenticate tailscale with tailscale up --force-reauth --accept-routes"
echo "Install wifi adapter drivers with install_driver.sh"