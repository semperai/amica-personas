import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { createPersonaFixture } from "./shared/fixtures";
import { ERC20Implementation } from "../typechain-types/contracts/ERC20Implementation";

describe("ERC20Implementation Simple Vulnerability Test", function () {
    it("Should prevent duplicate token claims in persona tokens", async function () {
        // Use the createPersonaFixture which already creates a persona
        const { personaFactory, amicaToken, tokenId, user1, user2 } = await loadFixture(createPersonaFixture);

        // Get persona info - need to check the actual structure
        // For now, let's get the token address from the blockchain events
        const filter = personaFactory.filters.PersonaCreated();
        const events = await personaFactory.queryFilter(filter);
        
        // Find our token's event
        let tokenAddress;
        for (const event of events) {
            const parsedLog = personaFactory.interface.parseLog({
                topics: event.topics as string[],
                data: event.data
            });
            if (parsedLog && parsedLog.args.tokenId.toString() === tokenId.toString()) {
                tokenAddress = parsedLog.args.tokenAddress;
                break;
            }
        }

        if (!tokenAddress) {
            throw new Error("Token address not found");
        }

        // Get the token contract
        const ERC20Implementation = await ethers.getContractFactory("ERC20Implementation");
        const token = ERC20Implementation.attach(tokenAddress) as ERC20Implementation;

        // Buy some tokens for user2
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("50000")
        );
        
        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            ethers.parseEther("50000"),
            0,
            user2.address,
            Math.floor(Date.now() / 1000) + 3600
        );

        // Deploy test tokens and send to the persona token contract
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const usdc = await TestERC20.deploy("USDC", "USDC", ethers.parseEther("1000000"));
        const dai = await TestERC20.deploy("DAI", "DAI", ethers.parseEther("1000000"));
        
        await usdc.transfer(tokenAddress, ethers.parseEther("100000"));
        await dai.transfer(tokenAddress, ethers.parseEther("50000"));

        const usdcAddress = await usdc.getAddress();
        const daiAddress = await dai.getAddress();

        console.log("Testing ERC20Implementation vulnerability fix...");
        console.log("User2 token balance:", ethers.formatEther(await token.balanceOf(user2.address)));
        console.log("USDC in contract:", ethers.formatEther(await usdc.balanceOf(tokenAddress)));
        console.log("DAI in contract:", ethers.formatEther(await dai.balanceOf(tokenAddress)));

        // TEST 1: Should prevent duplicate token claims
        await expect(
            token.connect(user2).burnAndClaim(
                ethers.parseEther("10000"),
                [usdcAddress, usdcAddress] // Duplicate
            )
        ).to.be.revertedWith("Tokens must be sorted and unique");
        console.log("✓ Duplicate token claim prevented!");

        // TEST 2: Should prevent unsorted tokens
        const addresses = [usdcAddress, daiAddress];
        const sortedAddresses = [...addresses].sort((a, b) => 
            BigInt(a) > BigInt(b) ? 1 : -1
        );
        
        // If already sorted, reverse to make unsorted
        if (addresses[0] === sortedAddresses[0]) {
            addresses.reverse();
        }

        await expect(
            token.connect(user2).burnAndClaim(
                ethers.parseEther("10000"),
                addresses // Unsorted
            )
        ).to.be.revertedWith("Tokens must be sorted and unique");
        console.log("✓ Unsorted token array prevented!");

        // TEST 3: Should allow legitimate claims with sorted unique tokens
        const usdcBefore = await usdc.balanceOf(user2.address);
        const daiBefore = await dai.balanceOf(user2.address);
        
        await token.connect(user2).burnAndClaim(
            ethers.parseEther("10000"),
            sortedAddresses // Properly sorted
        );
        
        const usdcAfter = await usdc.balanceOf(user2.address);
        const daiAfter = await dai.balanceOf(user2.address);
        
        expect(usdcAfter).to.be.gt(usdcBefore);
        expect(daiAfter).to.be.gt(daiBefore);
        
        console.log("✓ Legitimate claim works!");
        console.log("USDC claimed:", ethers.formatEther(usdcAfter - usdcBefore));
        console.log("DAI claimed:", ethers.formatEther(daiAfter - daiBefore));

        // TEST 4: Demonstrate impact of vulnerability if it existed
        const totalSupply = await token.totalSupply();
        const burnAmount = ethers.parseEther("10000");
        const sharePercentage = (burnAmount * ethers.parseEther("1")) / totalSupply;
        const remainingUsdc = await usdc.balanceOf(tokenAddress);
        const legitimateClaim = (remainingUsdc * sharePercentage) / ethers.parseEther("1");

        console.log("\nVulnerability impact if not fixed:");
        console.log("Legitimate USDC claim per burn:", ethers.formatEther(legitimateClaim));
        console.log("With 3x duplicate exploit:", ethers.formatEther(legitimateClaim * 3n));
        console.log("This would drain the contract unfairly!");
    });
});
