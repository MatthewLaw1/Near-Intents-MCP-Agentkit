import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Deploying contracts to Base...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Bridge contract first
  console.log("\nDeploying Bridge contract...");
  const Bridge = await ethers.getContractFactory("Bridge");
  const bridge = await Bridge.deploy(process.env.CDP_AGENT_ADDRESS);
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  console.log("Bridge deployed to:", bridgeAddress);

  // Deploy IntentManager contract
  console.log("\nDeploying IntentManager contract...");
  const IntentManager = await ethers.getContractFactory("IntentManager");
  const intentManager = await IntentManager.deploy(bridgeAddress, process.env.CDP_AGENT_ADDRESS);
  await intentManager.waitForDeployment();
  const intentManagerAddress = await intentManager.getAddress();
  console.log("IntentManager deployed to:", intentManagerAddress);

  // Add some test tokens to bridge for development
  if (process.env.TEST_TOKEN_ADDRESS) {
    console.log("\nAdding test token to bridge...");
    await bridge.addSupportedToken(process.env.TEST_TOKEN_ADDRESS);
    console.log("Test token added to bridge");
  }

  console.log("\nDeployment complete! Contract addresses:");
  console.log("Bridge:", bridgeAddress);
  console.log("IntentManager:", intentManagerAddress);
  console.log("\nUpdate your .env file with these addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });