// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title IntentManager
 * @notice Manages cross-chain transfer intents from Base to NEAR using CDP AgentKit
 */
contract IntentManager is ReentrancyGuard {
    using ECDSA for bytes32;

    struct Intent {
        string id;          // CDP Intent ID
        address sender;
        string nearReceiver;  // NEAR account format
        address asset;
        uint256 amount;
        uint256 expiration;
        bool executed;
        IntentStatus status;
    }

    enum IntentStatus {
        Pending,
        Executing,
        Completed,
        Failed
    }

    // Mapping from intent ID to Intent struct
    mapping(string => Intent) public intents;
    
    // Bridge contract address
    address public immutable bridge;
    
    // CDP Agent address
    address public cdpAgent;

    event IntentCreated(
        string indexed intentId,
        address indexed sender,
        string nearReceiver,
        address asset,
        uint256 amount,
        uint256 expiration
    );

    event IntentStatusUpdated(
        string indexed intentId,
        IntentStatus status
    );

    event IntentExecuted(string indexed intentId);

    modifier onlyAgent() {
        require(msg.sender == cdpAgent, "Only CDP agent can call this");
        _;
    }

    constructor(address _bridge, address _cdpAgent) {
        require(_bridge != address(0), "Invalid bridge address");
        require(_cdpAgent != address(0), "Invalid agent address");
        bridge = _bridge;
        cdpAgent = _cdpAgent;
    }

    /**
     * @notice Creates a new cross-chain transfer intent
     * @param intentId Unique CDP intent ID
     * @param nearReceiver The NEAR account to receive the tokens
     * @param asset The token address to transfer
     * @param amount The amount of tokens to transfer
     * @param expiration The timestamp after which the intent expires
     */
    function createIntent(
        string calldata intentId,
        string calldata nearReceiver,
        address asset,
        uint256 amount,
        uint256 expiration
    ) external nonReentrant {
        require(expiration > block.timestamp, "Intent expired");
        require(intents[intentId].sender == address(0), "Intent already exists");
        
        // Check allowance and balance
        require(
            IERC20(asset).allowance(msg.sender, address(this)) >= amount,
            "Insufficient allowance"
        );
        require(
            IERC20(asset).balanceOf(msg.sender) >= amount,
            "Insufficient balance"
        );

        // Store intent
        intents[intentId] = Intent({
            id: intentId,
            sender: msg.sender,
            nearReceiver: nearReceiver,
            asset: asset,
            amount: amount,
            expiration: expiration,
            executed: false,
            status: IntentStatus.Pending
        });

        emit IntentCreated(
            intentId,
            msg.sender,
            nearReceiver,
            asset,
            amount,
            expiration
        );
    }

    /**
     * @notice Updates intent status (only callable by CDP agent)
     * @param intentId The ID of the intent
     * @param status The new status
     */
    function updateIntentStatus(
        string calldata intentId,
        IntentStatus status
    ) external onlyAgent {
        require(intents[intentId].sender != address(0), "Intent does not exist");
        
        intents[intentId].status = status;
        
        emit IntentStatusUpdated(intentId, status);
    }

    /**
     * @notice Executes an intent by locking tokens in the bridge contract
     * @param intentId The ID of the intent
     */
    function executeIntent(string calldata intentId) external onlyAgent nonReentrant {
        Intent storage intent = intents[intentId];
        
        require(intent.sender != address(0), "Intent does not exist");
        require(!intent.executed, "Intent already executed");
        require(block.timestamp <= intent.expiration, "Intent expired");
        require(intent.status == IntentStatus.Pending, "Intent not in pending status");

        // Mark as executed and update status before external calls
        intent.executed = true;
        intent.status = IntentStatus.Executing;
        emit IntentStatusUpdated(intentId, IntentStatus.Executing);

        // Transfer tokens to bridge contract
        require(
            IERC20(intent.asset).transferFrom(
                intent.sender,
                bridge,
                intent.amount
            ),
            "Token transfer failed"
        );

        // Update status to completed
        intent.status = IntentStatus.Completed;
        emit IntentStatusUpdated(intentId, IntentStatus.Completed);
        emit IntentExecuted(intentId);
    }

    /**
     * @notice Allows retrieving full intent data
     * @param intentId The ID of the intent
     */
    function getIntent(string calldata intentId) external view returns (
        address sender,
        string memory nearReceiver,
        address asset,
        uint256 amount,
        uint256 expiration,
        bool executed,
        IntentStatus status
    ) {
        Intent memory intent = intents[intentId];
        return (
            intent.sender,
            intent.nearReceiver,
            intent.asset,
            intent.amount,
            intent.expiration,
            intent.executed,
            intent.status
        );
    }

    /**
     * @notice Update CDP agent address (only callable by current agent)
     * @param newAgent The new agent address
     */
    function updateAgent(address newAgent) external onlyAgent {
        require(newAgent != address(0), "Invalid agent address");
        cdpAgent = newAgent;
    }
}