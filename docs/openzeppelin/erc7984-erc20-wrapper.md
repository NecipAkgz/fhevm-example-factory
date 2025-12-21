Bridge between public ERC20 and confidential ERC7984 tokens. Allows users to wrap regular ERC20 tokens into privacy-preserving ERC7984 tokens (public → private) and unwrap them back (private → public). Wrapping is instant, unwrapping requires decryption proof from KMS. Essential for bringing existing tokens into the confidential ecosystem.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (1 items)</summary>

**Types:** `euint64`

</details>

{% tabs %}

{% tab title="ERC7984ERC20WrapperExample.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {
    ERC7984ERC20Wrapper as ERC7984ERC20WrapperBase,
    ERC7984
} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/**
 * @notice Bridge between public ERC20 and confidential ERC7984 tokens.
 *         Allows users to wrap regular ERC20 tokens into privacy-preserving
 *         ERC7984 tokens (public → private) and unwrap them back (private → public).
 *         Wrapping is instant, unwrapping requires decryption proof from KMS.
 *         Essential for bringing existing tokens into the confidential ecosystem.
 *
 * @dev WRAP: ERC20 → ERC7984 (public → private)
 *      UNWRAP: ERC7984 → ERC20 (private → public, requires decryption)
 */
contract ERC7984ERC20WrapperExample is
    ERC7984ERC20WrapperBase,
    ZamaEthereumConfig
{
    /// @notice Creates a new ERC20-to-ERC7984 wrapper
    /// @param token The ERC20 token to wrap
    /// @param name Name for the wrapped ERC7984 token
    /// @param symbol Symbol for the wrapped ERC7984 token
    /// @param uri Metadata URI for the wrapped token
    constructor(
        IERC20 token,
        string memory name,
        string memory symbol,
        string memory uri
    ) ERC7984ERC20WrapperBase(token) ERC7984(name, symbol, uri) {}

    // 📦 Inherited from ERC7984ERC20Wrapper:
    //
    // wrap(address to, uint256 amount)
    //   - User approves this contract for ERC20
    //   - ERC20 is escrowed, ERC7984 is minted
    //
    // unwrap(address from, address to, euint64 amount)
    //   - ERC7984 is burned
    //   - Decryption is requested
    //   - After proof, ERC20 is released
}

```

{% endtab %}

{% tab title="ERC7984ERC20Wrapper.ts" %}

```typescript
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

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

      // Check confidential balance exists
      const balanceHandle = await wrapper.confidentialBalanceOf(user.address);
      expect(balanceHandle).to.not.be.undefined;
    });

    it("should fail wrapping without approval", async function () {
      await expect(wrapper.connect(user).wrap(user.address, WRAP_AMOUNT)).to.be
        .reverted;
    });
  });
});

```

{% endtab %}

{% endtabs %}
