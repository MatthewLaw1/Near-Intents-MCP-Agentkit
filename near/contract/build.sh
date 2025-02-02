#!/bin/bash

# Exit on error
set -e

echo "Building NEAR contract..."

# Build the contract
RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release

# Create res directory if it doesn't exist
mkdir -p res

# Copy wasm file to res directory
cp target/wasm32-unknown-unknown/release/near_intents.wasm res/

echo "Build complete! Contract binary is in res/near_intents.wasm"
echo "To deploy, run: near deploy --accountId your.testnet.near --wasmFile res/near_intents.wasm"