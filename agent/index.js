import { ethers } from 'ethers';
import { connect, keyStores, utils } from 'near-api-js';
import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// Basic intent processor class
class IntentProcessor {
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.initializeProviders();
    this.setupRoutes();
    this.intents = new Map(); // Store intents in memory (use a database in production)
  }

  async initializeProviders() {
    // Initialize Base provider
    this.baseProvider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    this.bridgeContract = new ethers.Contract(
      process.env.BRIDGE_ADDRESS,
      ['event TokensLocked(string indexed intentId, address indexed token, address indexed from, string nearReceiver, uint256 amount, uint256 timestamp)'],
      new ethers.Wallet(process.env.BASE_PRIVATE_KEY, this.baseProvider)
    );

    // Initialize NEAR connection
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(
      process.env.NEAR_NETWORK_ID || 'testnet',
      process.env.NEAR_ACCOUNT_ID,
      utils.KeyPair.fromString(process.env.NEAR_PRIVATE_KEY)
    );

    this.nearConnection = await connect({
      networkId: process.env.NEAR_NETWORK_ID || 'testnet',
      nodeUrl: process.env.NEAR_NODE_URL,
      keyStore,
    });
  }

  setupRoutes() {
    // Create new intent
    this.app.post('/intents', async (req, res) => {
      try {
        const intent = req.body;
        const intentId = await this.createIntent(intent);
        res.json({ intentId });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get intent status
    this.app.get('/intents/:intentId', async (req, res) => {
      const intent = this.intents.get(req.params.intentId);
      if (!intent) {
        res.status(404).json({ error: 'Intent not found' });
        return;
      }
      res.json(intent);
    });
  }

  async createIntent(intent) {
    const intentId = ethers.id(Date.now().toString());
    
    // Validate intent
    if (!this.validateIntent(intent)) {
      throw new Error('Invalid intent');
    }

    // Store intent
    this.intents.set(intentId, {
      ...intent,
      status: 'pending',
      createdAt: Date.now()
    });

    // Start processing
    this.processIntent(intentId).catch(console.error);

    return intentId;
  }

  validateIntent(intent) {
    const { sourceChain, targetChain, token, amount, receiver } = intent;
    
    if (sourceChain !== 'base' || targetChain !== 'near') {
      return false;
    }

    if (!ethers.isAddress(token)) {
      return false;
    }

    if (!amount || amount <= 0) {
      return false;
    }

    if (!receiver) {
      return false;
    }

    return true;
  }

  async processIntent(intentId) {
    const intent = this.intents.get(intentId);
    if (!intent) return;

    try {
      // Update status
      intent.status = 'processing';
      this.intents.set(intentId, intent);

      // Execute on Base
      const baseResult = await this.executeOnBase(intentId, intent);
      if (!baseResult.success) {
        throw new Error(baseResult.error);
      }

      // Wait for event
      await this.waitForBaseEvent(intentId);

      // Execute on NEAR
      const nearResult = await this.executeOnNear(intentId, intent);
      if (!nearResult.success) {
        throw new Error(nearResult.error);
      }

      // Update status to completed
      intent.status = 'completed';
      this.intents.set(intentId, intent);

    } catch (error) {
      console.error('Intent processing failed:', error);
      intent.status = 'failed';
      intent.error = error.message;
      this.intents.set(intentId, intent);
    }
  }

  async executeOnBase(intentId, intent) {
    try {
      const { token, amount, receiver } = intent;

      // Lock tokens in bridge
      const tx = await this.bridgeContract.lockTokens(
        intentId,
        token,
        amount,
        receiver,
        { gasLimit: 300000 }
      );
      await tx.wait();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async waitForBaseEvent(intentId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for Base event'));
      }, 60000); // 1 minute timeout

      this.bridgeContract.once(
        'TokensLocked',
        (eventIntentId, token, from, receiver, amount, timestamp) => {
          if (eventIntentId === intentId) {
            clearTimeout(timeout);
            resolve();
          }
        }
      );
    });
  }

  async executeOnNear(intentId, intent) {
    try {
      const account = await this.nearConnection.account(process.env.NEAR_ACCOUNT_ID);
      
      await account.functionCall({
        contractId: process.env.NEAR_EXECUTOR_ID,
        methodName: 'execute_intent',
        args: {
          intent_id: intentId,
          receiver: intent.receiver,
          amount: intent.amount.toString()
        },
        gas: '300000000000000' // 300 TGas
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async start() {
    const port = process.env.PORT || 3000;
    this.app.listen(port, () => {
      console.log(`Intent processor listening on port ${port}`);
    });

    console.log('Monitoring for events...');
  }
}

// Start the processor
const processor = new IntentProcessor();
processor.start().catch(console.error);