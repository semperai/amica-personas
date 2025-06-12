import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export async function deployMockTokens(owner: HardhatEthersSigner) {
  const TestToken = await ethers.getContractFactory("TestERC20");

  const usdc = await TestToken.deploy("USD Coin", "USDC", ethers.parseEther("1000000"));
  const weth = await TestToken.deploy("Wrapped Ether", "WETH", ethers.parseEther("1000000"));
  const dai = await TestToken.deploy("Dai Stablecoin", "DAI", ethers.parseEther("1000000"));

  return { usdc, weth, dai };
}

export async function setupUsers(amicaToken: any, users: HardhatEthersSigner[]) {
  const amount = ethers.parseEther("10000");
  for (const user of users) {
    await amicaToken.withdraw(user.address, amount);
  }
}