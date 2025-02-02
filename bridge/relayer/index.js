import { ethers } from 'ethers';
import { connect, keyStores, utils, transactions } from 'near-api-js';
import dotenv from 'dotenv';
import { createHash } from 'crypto';

dotenv.config();

// Configuration
const config = {
  base: {
    rpc: process.env.BASE_RPC_URL,
    bridgeAddress: process.env.BRIDGE_ADDRESS,
    privateKey: process.env.RELAYER_PRIVATE_KEY
  },
  near: {
    networkId: process.env.NEAR_NETWORK_ID || 'testnet',
    nodeUrl: process.env.NEAR_NODE_URL,
    executorId: process.env.NEAR_EXECUTOR_ID,
    accountId: process.env.NEAR_ACCOUNT_ID,
    privateKey: process.env.NEAR_PRIVATE_KEY,
    intentServiceUrl: process.env.NEAR_INTENT_SERVICE_URL
  }
};

class Relayer {
  constructor() {
    this.initializeProviders();
  }

  async initializeProviders() {
    // Initialize Base provider
    this.baseProvider = new ethers.JsonRpcProvider(config.base.rpc);
    this.bridgeContract = new ethers.Contract(
      config.base.bridgeAddress,
      ['event TokensLocked(address indexed token, address indexed from, string nearReceiver, uint256 amount, uint256 timestamp)'],
      new ethers.Wallet(config.base.privateKey, this.baseProvider)
    );

    // Initialize NEAR connection
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(
      config.near.networkId,
      config.near.accountId,
      utils.KeyPair.fromString(config.near.privateKey)
    );

    this.nearConnection = await connect({
      networkId: config.near.networkId,
      nodeUrl: config.near.nodeUrl,
      keyStore,
    });
  }

  async start() {
    console.log('Starting relayer...');

    // Listen for TokensLocked events
    this.bridgeContract.on('TokensLocked', async (token, from, nearReceiver, amount, timestamp, event) => {
      try {
        console.log(`New TokensLocked event detected:
          Token: ${token}
          From: ${from}
          NEAR Receiver: ${nearReceiver}
          Amount: ${amount}
          Timestamp: ${timestamp}
        `);

        // Get transaction receipt for proof
        const receipt = await event.getTransactionReceipt();
        
        // Create proof
        const proof = {
          intentHash: createHash('sha256')
            .update(`${token}${from}${nearReceiver}${amount}${timestamp}`)
            .digest(),
          blockHeight: receipt.blockNumber,
          timestamp: timestamp,
          signatures: [], // Would be signed by validators in production
        };

        // Create and submit NEAR intent
        await this.createAndSubmitNearIntent(nearReceiver, amount, proof);

      } catch (error) {
        console.error('Error processing event:', error);
      }
    });

    console.log('Relayer is running and listening for events...');
  }

  async createAndSubmitNearIntent(receiver, amount, proof) {
    try {
      const account = await this.nearConnection.account(config.near.accountId);
      
      // First, get the NEAR Intent from the executor contract
      const nearIntent = await account.viewFunction({
        contractId: config.near.executorId,
        methodName: 'execute_intent',
        args: {
          intent: {
            receiver,
            amount: amount.toString(),
            proof
          }
        }
      });

      // Create the intent transaction
      const actions = nearIntent.actions.map(action => {
        if (action.FunctionCall) {
          return transactions.functionCall(
            action.FunctionCall.method_name,
            action.FunctionCall.args,
            new utils.BN(action.FunctionCall.gas),
            new utils.BN(action.FunctionCall.deposit)
          );
        }
        if (action.Transfer) {
          return transactions.transfer(new utils.BN(action.Transfer.amount));
        }
        throw new Error(`Unsupported action type`);
      });

      // Submit the intent to NEAR Intents service
      const response = await fetch(config.near.intentServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: {
            receiver_id: nearIntent.receiver_id,
            actions: actions
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit intent: ${await response.text()}`);
      }

      console.log(`Successfully submitted NEAR Intent:
        Receiver: ${receiver}
        Amount: ${amount}
        Intent ID: ${await response.text()}
      `);

    } catch (error) {
      console.error('Error submitting NEAR Intent:', error);
      throw error;
    }
  }
}

// Start the relayer
const relayer = new Relayer();
relayer.start().catch(console.error);