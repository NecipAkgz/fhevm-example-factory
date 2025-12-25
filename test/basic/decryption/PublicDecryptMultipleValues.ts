import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ClearValueType } from "@zama-fhe/relayer-sdk/node";
import { expect } from "chai";
import { ethers as EthersT } from "ethers";
import { ethers, fhevm } from "hardhat";
import * as hre from "hardhat";

import { HighestDieRoll, HighestDieRoll__factory } from "../types";
import { Signers } from "./types";

async function deployFixture() {
  // Contracts are deployed using the first signer/account by default
  const factory = (await ethers.getContractFactory(
    "HighestDieRoll"
  )) as HighestDieRoll__factory;
  const highestDiceRoll = (await factory.deploy()) as HighestDieRoll;
  const highestDiceRoll_address = await highestDiceRoll.getAddress();

  return { highestDiceRoll, highestDiceRoll_address };
}

/**
 * Public Decrypt Multiple Values Tests
 *
 * Tests asynchronous FHE public decryption for multiple values in a single batch.
 * Validates strict ordering of handles and batched proof verification.
 */
describe("HighestDieRoll", function () {
  let contract: HighestDieRoll;
  let contractAddress: string;
  let signers: Signers;
  let playerA: HardhatEthersSigner;
  let playerB: HardhatEthersSigner;

  before(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      owner: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
    };

    playerA = signers.alice;
    playerB = signers.bob;
  });

  beforeEach(async function () {
    // Deploy a new contract each time we run a new test
    const deployment = await deployFixture();
    contractAddress = deployment.highestDiceRoll_address;
    contract = deployment.highestDiceRoll;
  });

  /**
   * Helper: Parses the GameCreated event from a transaction receipt.
   * WARNING: This function is for illustrative purposes only and is not production-ready
   * (it does not handle several events in same tx).
   */
  function parseGameCreatedEvent(
    txReceipt: EthersT.ContractTransactionReceipt | null
  ): {
    txHash: `0x${string}`;
    gameId: number;
    playerA: `0x${string}`;
    playerB: `0x${string}`;
    playerAEncryptedDiceRoll: `0x${string}`;
    playerBEncryptedDiceRoll: `0x${string}`;
  } {
    const gameCreatedEvents: Array<{
      txHash: `0x${string}`;
      gameId: number;
      playerA: `0x${string}`;
      playerB: `0x${string}`;
      playerAEncryptedDiceRoll: `0x${string}`;
      playerBEncryptedDiceRoll: `0x${string}`;
    }> = [];

    if (txReceipt) {
      const logs = Array.isArray(txReceipt.logs)
        ? txReceipt.logs
        : [txReceipt.logs];
      for (let i = 0; i < logs.length; ++i) {
        const parsedLog = contract.interface.parseLog(logs[i]);
        if (!parsedLog || parsedLog.name !== "GameCreated") {
          continue;
        }
        const ge = {
          txHash: txReceipt.hash as `0x${string}`,
          gameId: Number(parsedLog.args[0]),
          playerA: parsedLog.args[1],
          playerB: parsedLog.args[2],
          playerAEncryptedDiceRoll: parsedLog.args[3],
          playerBEncryptedDiceRoll: parsedLog.args[4],
        };
        gameCreatedEvents.push(ge);
      }
    }

    // In this example, we expect on one single GameCreated event
    expect(gameCreatedEvents.length).to.eq(1);

    return gameCreatedEvents[0];
  }

  // ✅ Test should succeed
  it("decryption should succeed", async function () {
    console.log(``);
    console.log(`🎲 HighestDieRoll Game contract address: ${contractAddress}`);
    console.log(`   🤖 playerA.address: ${playerA.address}`);
    console.log(`   🎃 playerB.address: ${playerB.address}`);
    console.log(``);

    // 🚀 Starts a new Highest Die Roll game.
    // Each player rolls an encrypted die. The handles are emitted in the `GameCreated` event.
    const tx = await contract
      .connect(signers.owner)
      .highestDieRoll(playerA, playerB);

    // Parse the `GameCreated` event
    const gameCreatedEvent = parseGameCreatedEvent(await tx.wait())!;

    // GameId is 1 since we are playing the first game
    expect(gameCreatedEvent.gameId).to.eq(1);
    expect(gameCreatedEvent.playerA).to.eq(playerA.address);
    expect(gameCreatedEvent.playerB).to.eq(playerB.address);
    expect(await contract.getGamesCount()).to.eq(1);

    console.log(`✅ New game #${gameCreatedEvent.gameId} created!`);
    console.log(JSON.stringify(gameCreatedEvent, null, 2));

    const gameId = gameCreatedEvent.gameId;
    const playerADiceRoll = gameCreatedEvent.playerAEncryptedDiceRoll;
    const playerBDiceRoll = gameCreatedEvent.playerBEncryptedDiceRoll;

    // 🔓 Public Decryption Process (Multiple Values):
    // 1. Request decryption for ALL handles in a specific order.
    // ⚠️ The order MUST match how the contract expects to receive them.
    const publicDecryptResults = await fhevm.publicDecrypt([
      playerADiceRoll,
      playerBDiceRoll,
    ]);

    // The gateway returns a single proof that validates the entire batch.
    const abiEncodedClearGameResult =
      publicDecryptResults.abiEncodedClearValues;
    const decryptionProof = publicDecryptResults.decryptionProof;

    const clearValueA: ClearValueType =
      publicDecryptResults.clearValues[playerADiceRoll];
    const clearValueB: ClearValueType =
      publicDecryptResults.clearValues[playerBDiceRoll];

    expect(typeof clearValueA).to.eq("bigint");
    expect(typeof clearValueB).to.eq("bigint");

    // playerA's 8-sided die roll result (between 1 and 8)
    const a = (Number(clearValueA) % 8) + 1;
    // playerB's 8-sided die roll result (between 1 and 8)
    const b = (Number(clearValueB) % 8) + 1;

    const isDraw = a === b;
    const playerAWon = a > b;
    const playerBWon = a < b;

    console.log(``);
    console.log(`🎲 playerA's 8-sided die roll is ${a}`);
    console.log(`🎲 playerB's 8-sided die roll is ${b}`);

    // 🛡️ Verification:
    // Forward the batch results and the single proof back to the smart contract.
    await contract.recordAndVerifyWinner(
      gameId,
      abiEncodedClearGameResult,
      decryptionProof
    );

    const isRevealed = await contract.isGameRevealed(gameId);
    const winner = await contract.getWinner(gameId);

    expect(isRevealed).to.eq(true);
    expect(
      winner === playerA.address ||
        winner === playerB.address ||
        winner === EthersT.ZeroAddress
    ).to.eq(true);

    expect(isDraw).to.eq(winner === EthersT.ZeroAddress);
    expect(playerAWon).to.eq(winner === playerA.address);
    expect(playerBWon).to.eq(winner === playerB.address);

    console.log(``);
    if (winner === playerA.address) {
      console.log(`🤖 playerA is the winner 🥇🥇`);
    } else if (winner === playerB.address) {
      console.log(`🎃 playerB is the winner 🥇🥇`);
    } else if (winner === EthersT.ZeroAddress) {
      console.log(`Game is a draw!`);
    }
  });

  // 🛡️ Security Test: Wrong Ordering
  // The proof is cryptographically tied to the order of decrypted values.
  // Swapping the order of clear values will cause the proof verification to fail.
  it("decryption should fail when ABI-encoding is wrongly ordered", async function () {
    // Test Case: Verify strict ordering is enforced for cryptographic proof generation.
    // The `decryptionProof` is generated based on the expected order (A, B). By ABI-encoding
    // the clear values in the **reverse order** (B, A), we create a mismatch when the contract
    // internally verifies the proof (e.g., checks a signature against a newly computed hash).
    // This intentional failure is expected to revert with the `KMSInvalidSigner` error,
    // confirming the proof's order dependency.
    const tx = await contract
      .connect(signers.owner)
      .highestDieRoll(playerA, playerB);
    const gameCreatedEvent = parseGameCreatedEvent(await tx.wait())!;
    const gameId = gameCreatedEvent.gameId;
    const playerADiceRoll = gameCreatedEvent.playerAEncryptedDiceRoll;
    const playerBDiceRoll = gameCreatedEvent.playerBEncryptedDiceRoll;
    // Call `fhevm.publicDecrypt` using order (A, B)
    const publicDecryptResults = await fhevm.publicDecrypt([
      playerADiceRoll,
      playerBDiceRoll,
    ]);
    const clearValueA: ClearValueType =
      publicDecryptResults.clearValues[playerADiceRoll];
    const clearValueB: ClearValueType =
      publicDecryptResults.clearValues[playerBDiceRoll];
    const decryptionProof = publicDecryptResults.decryptionProof;
    expect(typeof clearValueA).to.eq("bigint");
    expect(typeof clearValueB).to.eq("bigint");
    expect(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256"],
        [clearValueA, clearValueB]
      )
    ).to.eq(publicDecryptResults.abiEncodedClearValues);
    const wrongOrderBAInsteadOfABAbiEncodedValues =
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256"],
        [clearValueB, clearValueA]
      );
    // ❌ Call `contract.recordAndVerifyWinner` using order (B, A)
    await expect(
      contract.recordAndVerifyWinner(
        gameId,
        wrongOrderBAInsteadOfABAbiEncodedValues,
        decryptionProof
      )
    ).to.be.revertedWithCustomError(
      {
        interface: new EthersT.Interface([
          "error KMSInvalidSigner(address invalidSigner)",
        ]),
      },
      "KMSInvalidSigner"
    );
  });
});
