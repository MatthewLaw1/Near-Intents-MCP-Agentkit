import { connect, keyStores, utils } from 'near-api-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Deploying NEAR contract...');

  // Configure NEAR connection
  const config = {
    networkId: process.env.NEAR_NETWORK_ID || 'testnet',
    nodeUrl: process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org',
    keyStore: new keyStores.UnencryptedFileSystemKeyStore(join(process.env.HOME, '.near-credentials')),
    walletUrl: 'https://wallet.testnet.near.org',
    helperUrl: 'https://helper.testnet.near.org'
  };

  // Connect to NEAR
  const near = await connect(config);
  const account = await near.account(process.env.NEAR_ACCOUNT_ID);

  console.log(`Connected to NEAR as ${process.env.NEAR_ACCOUNT_ID}`);

  try {
    // Deploy the contract
    console.log('\nDeploying contract...');
    const result = await account.deployContract(
      join(__dirname, '../res/near_intents.wasm')
    );
    console.log('Contract deployed successfully!');

    // Initialize the contract
    console.log('\nInitializing contract...');
    await account.functionCall({
      contractId: process.env.NEAR_ACCOUNT_ID,
      methodName: 'new',
      args: {
        token_contract: process.env.NEAR_TOKEN_CONTRACT,
        required_signatures: 1, // Set to appropriate value for production
        agent_account: process.env.CDP_AGENT_ACCOUNT
      },
      gas: '300000000000000' // 300 TGas
    });

    console.log('\nDeployment and initialization complete!');
    console.log('Contract ID:', process.env.NEAR_ACCOUNT_ID);
    console.log('\nMake sure to update your .env file with the contract address');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);