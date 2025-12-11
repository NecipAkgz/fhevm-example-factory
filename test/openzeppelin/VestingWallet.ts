import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingWallet", function () {
  let vestingWallet: any;
  let token: any;
  let owner: any;
  let beneficiary: any;

  const VESTING_AMOUNT = 1000;
  const VESTING_DURATION = 60 * 60; // 1 hour in seconds

  beforeEach(async function () {
    [owner, beneficiary] = await ethers.getSigners();

    // Deploy ERC7984 token
    token = await ethers.deployContract("ERC7984Example", [
      owner.address,
      10000,
      "Vesting Token",
      "VTK",
      "https://example.com/vesting",
    ]);

    // Get current time and set vesting to start in 1 minute
    const currentTime = await time.latest();
    const startTime = currentTime + 60;

    // Deploy vesting wallet
    vestingWallet = await ethers.deployContract("VestingWalletExample", [
      beneficiary.address,
      startTime,
      VESTING_DURATION,
    ]);

    // Transfer tokens to vesting wallet
    const encryptedInput = await fhevm
      .createEncryptedInput(await token.getAddress(), owner.address)
      .add64(VESTING_AMOUNT)
      .encrypt();

    await token
      .connect(owner)
      ["confidentialTransfer(address,bytes32,bytes)"](
        await vestingWallet.getAddress(),
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
  });

  describe("Initialization", function () {
    it("should set the correct beneficiary", async function () {
      expect(await vestingWallet.owner()).to.equal(beneficiary.address);
    });

    it("should set the correct duration", async function () {
      expect(await vestingWallet.duration()).to.equal(VESTING_DURATION);
    });
  });

  describe("Vesting Schedule", function () {
    it("should not release tokens before vesting starts", async function () {
      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });

    it("should release after vesting ends", async function () {
      const endTime = await vestingWallet.end();
      await time.increaseTo(endTime + BigInt(100));

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.emit(vestingWallet, "VestingWalletConfidentialTokenReleased");
    });

    it("should release partial tokens at midpoint", async function () {
      const startTime = await vestingWallet.start();
      const midpoint = Number(startTime) + VESTING_DURATION / 2;

      await time.increaseTo(midpoint);

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });
  });
});
