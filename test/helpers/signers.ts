import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export interface TestSigners {
  deployer: HardhatEthersSigner;
  owner: HardhatEthersSigner;
  user1: HardhatEthersSigner;
  user2: HardhatEthersSigner;
  user3: HardhatEthersSigner;
  treasury: HardhatEthersSigner;
  attacker: HardhatEthersSigner;
}

export async function getTestSigners(): Promise<TestSigners> {
  const [deployer, owner, user1, user2, user3, treasury, attacker] = await ethers.getSigners();

  return {
    deployer,
    owner,
    user1,
    user2,
    user3,
    treasury,
    attacker
  };
}
