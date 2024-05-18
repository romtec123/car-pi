#!/bin/bash
#Simple install script for brand new images

#Update packages & install new ones
echo "Updating and installing packages..."
sudo apt update -y && sudo apt upgrade -y

# Install tailscale repo and other packages from apt

curl -fsSL https://tailscale.com/install.sh | sh

sudo apt update

sudo apt install -y git curl neofetch btop htop nodejs npm cmake raspberrypi-kernel-headers lsb-release tailscale dkms

# Change node version
echo "Setting NodeJS version to 18."

sudo npm i -g n
sudo n 18

echo "Node is now version 18."

# Install wifi adapter drivers
echo "Installing WiFi adapter drivers."

git clone https://github.com/aircrack-ng/rtl8812au.git 
cd rtl8812au

sudo make dkms_install

cd ../
sudo rm -r rtl8812au 

#Download car-pi repo
git clone https://github.com/romtec123/car-pi
