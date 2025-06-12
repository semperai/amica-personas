import { ethers } from "hardhat";

export const CONSTANTS = {
  TOTAL_SUPPLY: ethers.parseEther("1000000000"),
  MINT_COST: ethers.parseEther("1000"),
  GRADUATION_COST: ethers.parseEther("10"),
  AMICA_DEPOSIT: ethers.parseEther("300000000"),
  PERSONA_TOKEN_SUPPLY: ethers.parseEther("1000000000"),
  LIQUIDITY_TOKEN_AMOUNT: ethers.parseEther("890000000"),
  GRADUATION_THRESHOLD: ethers.parseEther("100"),
  ZERO_ADDRESS: ethers.ZeroAddress,
  MAX_UINT256: ethers.MaxUint256,
};