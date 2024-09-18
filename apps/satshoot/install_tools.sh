#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Node.js and npm
if ! command_exists npm; then
    echo "Installing Node.js and npm..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "npm is already installed."
fi

# Install pnpm
if ! command_exists pnpm; then
    echo "Installing pnpm..."
    sudo npm install -g pnpm
else
    echo "pnpm is already installed."
fi

# Install turbo
if ! command_exists turbo; then
    echo "Installing turbo..."
    sudo npm install -g turbo
else
    echo "turbo is already installed."
fi

# Install just
if ! command_exists just; then
    echo "Installing just..."
    sudo curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | sudo bash -s -- --to /usr/local/bin
else
    echo "just is already installed."
fi

echo "Installation complete. You may need to restart your terminal or source your shell configuration file."


cd ../../.
apps/satshoot/./satshoot_manage.sh start
