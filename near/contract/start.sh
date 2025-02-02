#!/bin/bash

# Exit on error
set -e

echo "Starting Near Intents System..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create .env file with required configuration."
    exit 1
fi

# Source environment variables
source .env

# Check required environment variables
required_vars=(
    "BASE_RPC_URL"
    "BASE_PRIVATE_KEY"
    "BRIDGE_ADDRESS"
    "NEAR_NETWORK_ID"
    "NEAR_NODE_URL"
    "NEAR_ACCOUNT_ID"
    "NEAR_PRIVATE_KEY"
    "NEAR_EXECUTOR_ID"
    "PORT"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set in .env file"
        exit 1
    fi
done

echo "Starting Intent Processor..."
cd agent
npm start &
PROCESSOR_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "Shutting down..."
    kill $PROCESSOR_PID
    exit 0
}

# Set up cleanup on script exit
trap cleanup SIGINT SIGTERM

echo "System is running!"
echo "Intent Processor API is available at: http://localhost:$PORT"
echo ""
echo "Example usage:"
echo "1. Create intent:"
echo "   curl -X POST http://localhost:$PORT/intents \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"sourceChain\":\"base\",\"targetChain\":\"near\",\"token\":\"0x...\",\"amount\":\"1000000000000000000\",\"receiver\":\"receiver.testnet.near\"}'"
echo ""
echo "2. Check intent status:"
echo "   curl http://localhost:$PORT/intents/<intentId>"
echo ""
echo "Monitor transactions:"
echo "- Base Goerli Explorer: https://goerli.basescan.org"
echo "- NEAR Testnet Explorer: https://explorer.testnet.near.org"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running
wait