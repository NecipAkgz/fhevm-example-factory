Atomic swap from confidential ERC7984 to public ERC20 tokens. Demonstrates a two-step swap process using FHEVM v0.9 public decryption flow (makePubliclyDecryptable and checkSignatures) for trustless swaps.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (7 items)</summary>

**Types:** `euint64` · `externalEuint64`

**Functions:**
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.allowTransient()` - Grants TEMPORARY permission (expires at tx end)
- `FHE.checkSignatures()` - Verifies KMS decryption proof (reverts if invalid)
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.makePubliclyDecryptable()` - Marks ciphertext for public decryption via relayer

</details>

{% tabs %}

{% tab title="SwapERC7984ToERC20Example.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    IERC7984
} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Atomic swap from confidential ERC7984 to public ERC20 tokens.
 *         Demonstrates a two-step swap process using FHEVM v0.9 public decryption
 *         flow (makePubliclyDecryptable and checkSignatures) for trustless swaps.
 *
 * @dev Workflow: Initiate swap → KMS decryption → Finalize with proof.
 */
contract SwapERC7984ToERC20Example is ZamaEthereumConfig {
    using SafeERC20 for IERC20;

    error InvalidSwap(euint64 encryptedAmount);

    struct PendingSwap {
        address receiver;
        bool pending;
    }

    mapping(euint64 => PendingSwap) private _pendingSwaps;
    IERC7984 private _fromToken;
    IERC20 private _toToken;

    event SwapInitiated(
        euint64 indexed encryptedAmount,
        address indexed receiver
    );
    event SwapFinalized(address indexed receiver, uint64 amount);

    constructor(IERC7984 fromToken, IERC20 toToken) {
        _fromToken = fromToken;
        _toToken = toToken;
    }

    // ==================== STEP 1: INITIATE ====================

    /// @notice Start the swap - transfers ERC7984 and requests decryption
    function initiateSwap(
        externalEuint64 encryptedInput,
        bytes calldata inputProof
    ) public {
        euint64 amount = FHE.fromExternal(encryptedInput, inputProof);

        // Transfer ERC7984 from user to this contract
        FHE.allowTransient(amount, address(_fromToken));
        euint64 amountTransferred = _fromToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // 🔓 FHEVM v0.9: Request public decryption
        // KMS will provide proof that this value decrypts to X
        FHE.makePubliclyDecryptable(amountTransferred);
        FHE.allowThis(amountTransferred);

        // Register pending swap
        _pendingSwaps[amountTransferred] = PendingSwap({
            receiver: msg.sender,
            pending: true
        });

        emit SwapInitiated(amountTransferred, msg.sender);
    }

    // ==================== STEP 2: FINALIZE ====================

    /// @notice Complete the swap with decryption proof from KMS
    /// @dev encryptedAmount: The handle from initiateSwap
    ///      cleartextAmount: The decrypted value
    ///      decryptionProof: Proof from KMS that decryption is valid
    function finalizeSwap(
        euint64 encryptedAmount,
        uint64 cleartextAmount,
        bytes calldata decryptionProof
    ) public {
        PendingSwap storage pending = _pendingSwaps[encryptedAmount];
        require(pending.pending, InvalidSwap(encryptedAmount));

        // 🔐 FHEVM v0.9: Verify decryption proof
        // This ensures cleartextAmount is the TRUE decryption of encryptedAmount
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(encryptedAmount);
        FHE.checkSignatures(
            handles,
            abi.encode(cleartextAmount),
            decryptionProof
        );

        address receiver = pending.receiver;
        delete _pendingSwaps[encryptedAmount];

        // Release ERC20 to user
        if (cleartextAmount != 0) {
            _toToken.safeTransfer(receiver, cleartextAmount);
        }

        emit SwapFinalized(receiver, cleartextAmount);
    }
}

```

{% endtab %}

{% tab title="SwapERC7984ToERC20.ts" %}

```typescript
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

describe("SwapERC7984ToERC20", function () {
  let swap: any;
  let erc7984: any;
  let erc20Mock: any;
  let owner: any;
  let user: any;

  const INITIAL_ERC20 = 10000;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy ERC7984 mock
    erc7984 = await ethers.deployContract("ERC7984Example", [
      owner.address,
      10000,
      "Confidential Token",
      "CTKN",
      "https://example.com/token",
    ]);

    // Deploy ERC20 mock
    erc20Mock = await ethers.deployContract("ERC20Mock", [
      "Mock USDC",
      "USDC",
      6,
    ]);

    // Deploy swap contract
    swap = await ethers.deployContract("SwapERC7984ToERC20Example", [
      await erc7984.getAddress(),
      await erc20Mock.getAddress(),
    ]);

    // Fund swap contract with ERC20
    await erc20Mock.mint(await swap.getAddress(), INITIAL_ERC20);

    // Transfer some ERC7984 to user
    const encryptedInput = await fhevm
      .createEncryptedInput(await erc7984.getAddress(), owner.address)
      .add64(1000)
      .encrypt();

    await erc7984
      .connect(owner)
      ["confidentialTransfer(address,bytes32,bytes)"](
        user.address,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );

    // Set swap contract as operator for user
    const maxTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    await erc7984
      .connect(user)
      .setOperator(await swap.getAddress(), maxTimestamp);
  });

  describe("Swap Initiation", function () {
    it("should initiate a swap", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await swap.getAddress(), user.address)
        .add64(100)
        .encrypt();

      await expect(
        swap
          .connect(user)
          .initiateSwap(encryptedInput.handles[0], encryptedInput.inputProof)
      ).to.emit(swap, "SwapInitiated");
    });
  });
});

```

{% endtab %}

{% endtabs %}
