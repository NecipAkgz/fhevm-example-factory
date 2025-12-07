import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

describe("ConfidentialToken", function () {
  let token: any;
  let owner: any;
  let recipient: any;
  let other: any;

  const INITIAL_AMOUNT = 1000;
  const TRANSFER_AMOUNT = 100;

  beforeEach(async function () {
    [owner, recipient, other] = await ethers.getSigners();

    // Deploy ERC7984 contract
    token = await ethers.deployContract("ConfidentialToken", [
      owner.address,
      INITIAL_AMOUNT,
      "Confidential Token",
      "CTKN",
      "https://example.com/token",
    ]);
  });

  describe("Initialization", function () {
    it("should set the correct name", async function () {
      expect(await token.name()).to.equal("Confidential Token");
    });

    it("should set the correct symbol", async function () {
      expect(await token.symbol()).to.equal("CTKN");
    });

    it("should set the correct contract URI", async function () {
      expect(await token.contractURI()).to.equal("https://example.com/token");
    });

    it("should mint initial amount to owner", async function () {
      const balanceHandle = await token.confidentialBalanceOf(owner.address);
      expect(balanceHandle).to.not.be.undefined;
    });
  });

  describe("Transfer Process", function () {
    it("should transfer tokens from owner to recipient", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(TRANSFER_AMOUNT)
        .encrypt();

      await expect(
        token
          .connect(owner)
          ["confidentialTransfer(address,bytes32,bytes)"](
            recipient.address,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.not.be.reverted;

      const recipientBalanceHandle = await token.confidentialBalanceOf(
        recipient.address
      );
      const ownerBalanceHandle = await token.confidentialBalanceOf(
        owner.address
      );
      expect(recipientBalanceHandle).to.not.be.undefined;
      expect(ownerBalanceHandle).to.not.be.undefined;
    });

    it("should allow recipient to transfer received tokens", async function () {
      // First transfer from owner to recipient
      const encryptedInput1 = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(TRANSFER_AMOUNT)
        .encrypt();

      await token
        .connect(owner)
        ["confidentialTransfer(address,bytes32,bytes)"](
          recipient.address,
          encryptedInput1.handles[0],
          encryptedInput1.inputProof
        );

      // Second transfer from recipient to other
      const encryptedInput2 = await fhevm
        .createEncryptedInput(await token.getAddress(), recipient.address)
        .add64(50)
        .encrypt();

      await expect(
        token
          .connect(recipient)
          ["confidentialTransfer(address,bytes32,bytes)"](
            other.address,
            encryptedInput2.handles[0],
            encryptedInput2.inputProof
          )
      ).to.not.be.reverted;
    });

    it("should revert when sender has zero balance", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await token.getAddress(), recipient.address)
        .add64(100)
        .encrypt();

      await expect(
        token
          .connect(recipient)
          ["confidentialTransfer(address,bytes32,bytes)"](
            other.address,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      )
        .to.be.revertedWithCustomError(token, "ERC7984ZeroBalance")
        .withArgs(recipient.address);
    });

    it("should revert when transferring to zero address", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(TRANSFER_AMOUNT)
        .encrypt();

      await expect(
        token
          .connect(owner)
          ["confidentialTransfer(address,bytes32,bytes)"](
            ethers.ZeroAddress,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      )
        .to.be.revertedWithCustomError(token, "ERC7984InvalidReceiver")
        .withArgs(ethers.ZeroAddress);
    });
  });
});
