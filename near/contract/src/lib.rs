use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedSet};
use near_sdk::json_types::U128;
use near_sdk::{
    env, near_bindgen, AccountId, Balance, BorshStorageKey, PanicOnDefault, Promise,
    serde::{Deserialize, Serialize},
};

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    ExecutedIntents,
    Proofs,
    BridgeValidators,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct CrossChainIntent {
    pub id: String,
    pub sender: String,      // Base chain address
    pub receiver: AccountId, // NEAR account
    pub token: String,       // Token address on Base
    pub amount: U128,
    pub proof: BridgeProof,
    pub status: IntentStatus,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum IntentStatus {
    Pending,
    Executing,
    Completed,
    Failed(String),
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct BridgeProof {
    pub block_number: u64,
    pub timestamp: u64,
    pub transaction_hash: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct CrossChainExecutor {
    /// Set of executed intent IDs
    executed_intents: UnorderedSet<String>,
    /// Mapping of validator addresses
    bridge_validators: LookupMap<AccountId, bool>,
    /// Required number of validator signatures
    required_signatures: u32,
    /// Token contract address
    token_contract: AccountId,
    /// CDP Agent account
    agent_account: AccountId,
}

#[near_bindgen]
impl CrossChainExecutor {
    #[init]
    pub fn new(
        token_contract: AccountId,
        required_signatures: u32,
        agent_account: AccountId
    ) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        assert!(required_signatures > 0, "Required signatures must be > 0");

        Self {
            executed_intents: UnorderedSet::new(StorageKey::ExecutedIntents),
            bridge_validators: LookupMap::new(StorageKey::BridgeValidators),
            required_signatures,
            token_contract,
            agent_account,
        }
    }

    /// Add a bridge validator
    pub fn add_validator(&mut self, validator: AccountId) {
        self.assert_owner();
        self.bridge_validators.insert(&validator, &true);
    }

    /// Remove a bridge validator
    pub fn remove_validator(&mut self, validator: &AccountId) {
        self.assert_owner();
        self.bridge_validators.remove(validator);
    }

    /// Create a new cross-chain intent
    pub fn create_intent(&mut self, intent: CrossChainIntent) {
        // Only allow the CDP agent to create intents
        assert_eq!(
            env::predecessor_account_id(),
            self.agent_account,
            "Only CDP agent can create intents"
        );

        // Verify intent hasn't been executed
        assert!(
            !self.executed_intents.contains(&intent.id),
            "Intent already executed"
        );

        // Store intent as pending
        self.executed_intents.insert(&intent.id);

        // Emit event for tracking
        env::log_str(&format!("Intent created: {}", intent.id));
    }

    /// Execute a cross-chain intent
    pub fn execute_intent(&mut self, intent_id: String) -> Promise {
        // Only allow the CDP agent to execute intents
        assert_eq!(
            env::predecessor_account_id(),
            self.agent_account,
            "Only CDP agent can execute intents"
        );

        assert!(
            self.executed_intents.contains(&intent_id),
            "Intent not found"
        );

        // Transfer tokens to recipient
        Promise::new(self.token_contract.clone()).function_call(
            "ft_transfer".to_string(),
            format!(
                r#"{{"receiver_id": "{}", "amount": "{}"}}"#,
                env::predecessor_account_id(),
                "1" // Amount would come from intent data in production
            )
            .into_bytes(),
            1, // 1 yoctoNEAR deposit for storage
            near_sdk::Gas(5_000_000_000_000), // 5 TGas
        )
    }

    /// Get intent status
    pub fn get_intent_status(&self, intent_id: String) -> Option<IntentStatus> {
        if self.executed_intents.contains(&intent_id) {
            Some(IntentStatus::Completed)
        } else {
            None
        }
    }

    /// Assert caller is contract owner
    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "Only owner can call this method"
        );
    }

    /// View method to check if an account is a validator
    pub fn is_validator(&self, account_id: AccountId) -> bool {
        self.bridge_validators.contains_key(&account_id)
    }
}
