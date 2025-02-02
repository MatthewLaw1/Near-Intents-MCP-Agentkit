// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Bridge
 * @notice Handles token locking and unlocking for CDP-based cross-chain transfers
 */
contract Bridge is ReentrancyGuard, Ownable {
    // Mapping of supported tokens
    mapping(address => bool) public supportedTokens;
    
    // Mapping of locked token amounts
    mapping(address => uint256) public lockedTokens;

    // CDP Agent address
    address public cdpAgent;

    event TokensLocked(
        string indexed intentId,
        address indexed token,
        address indexed from,
        string nearReceiver,
        uint256 amount,
        uint256 timestamp
    );

    event TokensUnlocked(
        string indexed intentId,
        address indexed token,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    modifier onlyAgent() {
        require(msg.sender == cdpAgent, "Only CDP agent can call this");
        _;
    }

    constructor(address _cdpAgent) Ownable(msg.sender) {
        require(_cdpAgent != address(0), "Invalid agent address");
        cdpAgent = _cdpAgent;
    }

    /**
     * @notice Update CDP agent address (only callable by owner)
     * @param newAgent The new agent address
     */
    function updateAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "Invalid agent address");
        cdpAgent = newAgent;
    }

    /**
     * @notice Add a supported token
     * @param token The token address to add
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        supportedTokens[token] = true;
    }

    /**
     * @notice Remove a supported token
     * @param token The token address to remove
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @notice Lock tokens for cross-chain transfer (only callable by CDP agent)
     * @param intentId The CDP intent ID
     * @param token The token address
     * @param from The sender address
     * @param amount The amount to lock
     * @param nearReceiver The NEAR account to receive the tokens
     */
    function lockTokens(
        string calldata intentId,
        address token,
        address from,
        uint256 amount,
        string calldata nearReceiver
    ) external onlyAgent nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(nearReceiver).length > 0, "Invalid NEAR receiver");

        // Transfer tokens to this contract
        require(
            IERC20(token).transferFrom(from, address(this), amount),
            "Token transfer failed"
        );

        // Update locked amount
        lockedTokens[token] += amount;

        emit TokensLocked(
            intentId,
            token,
            from,
            nearReceiver,
            amount,
            block.timestamp
        );
    }

    /**
     * @notice Unlock tokens (only callable by CDP agent)
     * @param intentId The CDP intent ID
     * @param token The token address
     * @param to The recipient address
     * @param amount The amount to unlock
     */
    function unlockTokens(
        string calldata intentId,
        address token,
        address to,
        uint256 amount
    ) external onlyAgent nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(lockedTokens[token] >= amount, "Insufficient locked tokens");

        // Update locked amount
        lockedTokens[token] -= amount;

        // Transfer tokens to recipient
        require(
            IERC20(token).transfer(to, amount),
            "Token transfer failed"
        );

        emit TokensUnlocked(
            intentId,
            token,
            to,
            amount,
            block.timestamp
        );
    }

    /**
     * @notice Get locked token amount
     * @param token The token address
     */
    function getLockedAmount(address token) external view returns (uint256) {
        return lockedTokens[token];
    }

    /**
     * @notice Check if a token is supported
     * @param token The token address to check
     */
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }
}