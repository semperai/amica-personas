import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

export async function increaseTime(seconds: number) {
  await time.increase(seconds);
}

export async function setNextBlockTimestamp(timestamp: number) {
  await time.setNextBlockTimestamp(timestamp);
}

export async function getLatestTimestamp(): Promise<number> {
  return await time.latest();
}

export async function mine(blocks: number = 1) {
  for (let i = 0; i < blocks; i++) {
    await time.increase(1);
  }
}