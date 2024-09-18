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


# Function to check if we're in the correct directory
check_directory() {
    if [ ! -f "package.json" ] || [ ! -f "pnpm-workspace.yaml" ]; then
        echo "Error: You don't seem to be in the root directory of the satshoot project."
        echo "Please navigate to the root directory and try again."
        exit 1
    fi
}

# Function to check if pnpm is installed
check_pnpm() {
    if ! command -v pnpm &> /dev/null; then
        echo "Error: pnpm is not installed. Please install it first."
        echo "You can use the install_tools.sh script to install pnpm and other required tools."
        exit 1
    fi
}

# Main script
echo "Starting satshoot setup and development server..."

cd ../../.

# Check if we're in the correct directory
check_directory

# Check if pnpm is installed
check_pnpm

# Step 4: Install all packages recursively
echo "Installing packages..."
pnpm i

# Check if installation was successful
if [ $? -ne 0 ]; then
    echo "Error: Package installation failed. Please check the error messages above."
    exit 1
fi

# Open port on VPS
sudo ufw allow 5173

# Step 5: Start the dev server
echo "Starting development server..."
pnpm run dev
