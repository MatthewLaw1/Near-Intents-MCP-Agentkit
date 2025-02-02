# Near Intents

A cross-chain intent system enabling secure token transfers between Ethereum (Sepolia) and NEAR testnets.

## Prerequisites

- Node.js v16+ and npm
- Rust and Cargo
- NEAR CLI
- MetaMask wallet
- Sepolia testnet ETH
- NEAR testnet account

## Quick Start

1. Set up your wallets:

### Ethereum (Sepolia) Setup:
```bash
# 1. Install MetaMask: https://metamask.io

# 2. Add Sepolia network to MetaMask:
Network Name: Sepolia
RPC URL: https://rpc.sepolia.org
Chain ID: 11155111
Currency Symbol: ETH

# 3. Get Sepolia ETH:
Visit https://sepoliafaucet.com
Connect wallet and request ETH

# 4. Get your private key from MetaMask:
Account Details -> Export Private Key
```

### NEAR Setup:
```bash
# 1. Create testnet account:
Visit https://wallet.testnet.near.org
Create account and note your account ID

# 2. Install NEAR CLI:
npm install -g near-cli

# 3. Login to get credentials:
near login

# 4. Get your private key:
cat ~/.near-credentials/testnet/your-account.testnet.near.json
# Copy the "private_key" value
```

2. Install dependencies:
```bash
# Install Base contract dependencies
cd base
npm install

# Install agent dependencies
cd ../agent
npm install
```

3. Configure environment:
```bash
# Copy example config
cp .env.example .env

# Edit .env with your values:
# - PRIVATE_KEY (from MetaMask)
# - NEAR_ACCOUNT_ID (your testnet account)
# - NEAR_PRIVATE_KEY (from credentials file)
```

4. Deploy contracts:
```bash
# Deploy Ethereum contracts
cd base
npx hardhat run scripts/deploy.js --network sepolia
# Copy the BRIDGE_ADDRESS to your .env

# Build and deploy NEAR contract
cd ../near/contract
chmod +x build.sh
./build.sh
node deploy.js
# Copy the contract ID to NEAR_EXECUTOR_ID in .env
```

5. Start the system:
```bash
chmod +x start.sh
./start.sh
```

## Testing Cross-Chain Transfers

1. Approve USDC for transfer:
```javascript
// Using ethers.js in Node REPL or browser console
const { ethers } = require('ethers');
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const usdcAddress = '0xf492Bf25f06F6a96a4c1b6eC2C4fd5eE6B6A2f3e'; // Sepolia USDC
const abi = ['function approve(address spender, uint256 amount) public returns (bool)'];
const usdc = new ethers.Contract(usdcAddress, abi, signer);
await usdc.approve(BRIDGE_ADDRESS, ethers.utils.parseUnits('1000', 6)); // USDC has 6 decimals
```

2. Create cross-chain transfer:
```bash
curl -X POST http://localhost:3000/intents \
  -H "Content-Type: application/json" \
  -d '{
    "sourceChain": "sepolia",
    "targetChain": "near",
    "token": "0xf492Bf25f06F6a96a4c1b6eC2C4fd5eE6B6A2f3e",
    "amount": "1000000",
    "receiver": "your-account.testnet.near"
  }'
```

3. Monitor transfer status:
```bash
curl http://localhost:3000/intents/<intentId>
```

4. View transactions:
- Sepolia Explorer: https://sepolia.etherscan.io
- NEAR Testnet Explorer: https://explorer.testnet.near.org

## Monitoring

The start script provides real-time monitoring of:
- Intent creation and execution
- Cross-chain events
- Transaction status
- Error reporting

## Troubleshooting

1. If transactions fail on Sepolia:
- Ensure you have enough Sepolia ETH for gas
- Check token approval status
- Verify contract addresses in .env

2. If NEAR transactions fail:
- Ensure account has enough NEAR for storage
- Verify contract deployment
- Check account permissions

## Security Notes

- This is a testnet implementation
- Use only test tokens and accounts
- Keep private keys secure
- Monitor intent status for completion
- Implement proper error handling in production

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)