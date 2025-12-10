import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

describe("SwapERC7984ToERC7984", function () {
  let swap: any;
  let tokenA: any;
  let tokenB: any;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy two ERC7984 tokens
    tokenA = await ethers.deployContract("ERC7984Example", [
      owner.address,
      10000,
      "Token A",
      "TKA",
      "https://example.com/a",
    ]);

    tokenB = await ethers.deployContract("ERC7984Example", [
      owner.address,
      10000,
      "Token B",
      "TKB",
      "https://example.com/b",
    ]);

    // Deploy swap contract
    swap = await ethers.deployContract("SwapERC7984ToERC7984Example", []);

    // Transfer tokenA to user
    const encryptedInputA = await fhevm
      .createEncryptedInput(await tokenA.getAddress(), owner.address)
      .add64(1000)
      .encrypt();

    await tokenA
      .connect(owner)
      [
        "confidentialTransfer(address,bytes32,bytes)"
      ](user.address, encryptedInputA.handles[0], encryptedInputA.inputProof);

    // Transfer tokenB to swap contract
    const encryptedInputB = await fhevm
      .createEncryptedInput(await tokenB.getAddress(), owner.address)
      .add64(1000)
      .encrypt();

    await tokenB
      .connect(owner)
      [
        "confidentialTransfer(address,bytes32,bytes)"
      ](await swap.getAddress(), encryptedInputB.handles[0], encryptedInputB.inputProof);

    // Set swap as operator for user's tokenA
    const maxTimestamp = Math.floor(Date.now() / 1000) + 3600;
    await tokenA.connect(user).setOperator(await swap.getAddress(), maxTimestamp);
  });

  describe("Swap", function () {
    it("should swap tokenA for tokenB", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await swap.getAddress(), user.address)
        .add64(100)
        .encrypt();

      await expect(
        swap
          .connect(user)
          .swapConfidentialForConfidential(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            encryptedInput.handles[0],
            encryptedInput.inputProof,
          ),
      ).to.not.be.reverted;

      // User should have tokenB balance
      const balanceB = await tokenB.confidentialBalanceOf(user.address);
      expect(balanceB).to.not.be.undefined;
    });

    it("should fail without operator authorization", async function () {
      // Remove operator
      await tokenA.connect(user).setOperator(await swap.getAddress(), 0);

      const encryptedInput = await fhevm
        .createEncryptedInput(await tokenA.getAddress(), user.address)
        .add64(100)
        .encrypt();

      await expect(
        swap
          .connect(user)
          .swapConfidentialForConfidential(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            encryptedInput.handles[0],
            encryptedInput.inputProof,
          ),
      ).to.be.reverted;
    });
  });
});
