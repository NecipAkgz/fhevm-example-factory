import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

/**
 * ERC-7984 / ERC-20 Wrapper Tests
 *
 * Tests the wrapping of public ERC-20 tokens into confidential ERC-7984 tokens.
 * Validates the on-ramp process from public funds to a private financial layer.
 */
describe("ERC7984ERC20Wrapper", function () {
  let wrapper: any;
  let erc20Mock: any;
  let owner: any;
  let user: any;

  const WRAP_AMOUNT = 1000;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy mock ERC20
    erc20Mock = await ethers.deployContract("ERC20Mock", [
      "Mock USDC",
      "USDC",
      6,
    ]);

    // Mint ERC20 to user
    await erc20Mock.mint(user.address, WRAP_AMOUNT * 2);

    // Deploy wrapper
    wrapper = await ethers.deployContract("ERC7984ERC20WrapperExample", [
      await erc20Mock.getAddress(),
      "Wrapped USDC",
      "wUSDC",
      "https://example.com/wrapped",
    ]);
  });

  describe("Initialization", function () {
    it("should set the correct underlying token", async function () {
      expect(await wrapper.underlying()).to.equal(await erc20Mock.getAddress());
    });

    it("should set the correct name and symbol", async function () {
      expect(await wrapper.name()).to.equal("Wrapped USDC");
      expect(await wrapper.symbol()).to.equal("wUSDC");
    });
  });

  describe("Wrapping", function () {
    it("should wrap ERC20 tokens", async function () {
      // Approve wrapper
      await erc20Mock
        .connect(user)
        .approve(await wrapper.getAddress(), WRAP_AMOUNT);

      // Wrap tokens
      await expect(wrapper.connect(user).wrap(user.address, WRAP_AMOUNT)).to.not
        .be.reverted;

      // Check ERC20 was transferred
      expect(await erc20Mock.balanceOf(await wrapper.getAddress())).to.equal(
        WRAP_AMOUNT
      );

      // 🔐 Wrapping Process:
      // The public ERC-20 tokens are locked in this contract, and an equivalent
      // amount of confidential ERC-7984 handles are "minted" for the user.
      // From this point on, the user's balance and transfers are private.
      const balanceHandle = await wrapper.confidentialBalanceOf(user.address);
      expect(balanceHandle).to.not.be.undefined;
    });

    it("should fail wrapping without approval", async function () {
      await expect(wrapper.connect(user).wrap(user.address, WRAP_AMOUNT)).to.be
        .reverted;
    });
  });
});
