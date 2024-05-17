#!/bin/bash
#Simple install script for brand new images

#Update packages & install new ones
echo "Updating and installing packages..."
sudo apt update -y && sudo apt upgrade -y

# Install tailscale repo and other packages from apt

curl -L https://pkgs.tailscale.com/stable/raspbian/$(lsb_release -cs).noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/tailscale-archive-keyring.gpg] https://pkgs.tailscale.com/stable/raspbian $(lsb_release -cs) main" | sudo tee  /etc/apt/sources.list.d/tailscale.list

sudo apt update

sudo apt install -y git curl neofetch btop htop nodejs npm cmake raspberrypi-kernel-headers bc mokutil build-essential libelf-dev linux-headers-`uname -r` lsb-release tailscale

# Change node version
echo "Setting NodeJS version to 18."

sudo npm i -g n
sudo n 18

echo "Node is now version 18."

# Install wifi adapter drivers
echo "Installing WiFi adapter drivers."

git clone https://github.com/aircrack-ng/rtl8812au.git 
cd rtl8812au
sudo make
sudo make install 

cd ../
sudo rm -r rtl8812au #cleanup

