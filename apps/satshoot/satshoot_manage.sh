#!/bin/bash

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

# Function to start the development server
start_server() {
    echo "Installing packages..."
    pnpm i

    if [ $? -ne 0 ]; then
	echo "Error: Package installation failed. Please check the error messages above."
	exit 1
    fi
    
    echo "Checking if port 5173 is already open..."
    if command -v netstat > /dev/null; then
        if netstat -tuln | grep -q :5173; then
            echo "Port 5173 is already open."
        else
            echo "Port 5173 is not open. You may need to open it in your firewall."
            echo "Run: sudo ufw allow 5173"
	    echo "Opening port 5173..."
	    sudo ufw allow 5173
            if [ $? -ne 0 ]; then
		echo "Error: Failed to open port 5173. Please check your firewall settings."
		exit 1
            fi
        fi
    elif command -v ss > /dev/null; then
        if ss -tuln | grep -q :5173; then
            echo "Port 5173 is already open."
        else
            echo "Port 5173 is not open. You may need to open it in your firewall."
            echo "Run: sudo ufw allow 5173"
	    echo "Opening port 5173..."
	    sudo ufw allow 5173
            if [ $? -ne 0 ]; then
		echo "Error: Failed to open port 5173. Please check your firewall settings."
		exit 1
            fi
        fi
    else
        echo "Unable to check if port 5173 is open. Please ensure it's open in your firewall."
        echo "You may need to run: sudo ufw allow 5173"
    fi

    pnpm run dev
}

# Function to stop the development server
stop_server() {
    echo "Stopping the development server..."
    pkill -f "pnpm run dev"
    if [ $? -eq 0 ]; then
        echo "Development server stopped successfully."
    else
        echo "Error: Failed to stop the development server. It may not be running."
    fi
}

# Function to add original_ndk remote
add_original_ndk() {
    echo "Adding original_ndk remote..."
    git remote add original_ndk https://github.com/nostr-dev-kit/ndk.git
    echo "Remote added. You can now fetch and merge from this remote."
}

# Function to make a clean build with ndk
clean_build() {
    echo "Performing clean build with ndk..."
    just renew
}

# Main script
check_directory
check_pnpm



case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    add-remote)
        add_original_ndk
        ;;
    clean-build)
        clean_build
        ;;
    *)
        echo "Usage: $0 {start|stop|add-remote|clean-build}"
        exit 1
        ;;
esac


