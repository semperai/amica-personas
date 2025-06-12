import { task } from "hardhat/config";

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("balance", "Prints an account's balance")
  .addParam("account", "The account's address")
  .setAction(async (taskArgs, hre) => {
    const balance = await hre.ethers.provider.getBalance(taskArgs.account);
    console.log(hre.ethers.formatEther(balance), "ETH");
  });

task("create-persona", "Creates a new persona")
  .addParam("factory", "PersonaTokenFactory address")
  .addParam("name", "Persona name")
  .addParam("symbol", "Persona symbol")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", taskArgs.factory);

    const tx = await factory.createPersona(
      await factory.amicaToken(),
      taskArgs.name,
      taskArgs.symbol,
      [],
      []
    );

    const receipt = await tx.wait();
    console.log("Persona created! Transaction:", receipt?.hash);
  });
