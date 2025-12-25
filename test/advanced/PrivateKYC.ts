import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { PrivateKYC, PrivateKYC__factory } from "../types";
import { expect } from "chai";

type Signers = {
  owner: HardhatEthersSigner;
  user1: HardhatEthersSigner;
  user2: HardhatEthersSigner;
};

// Country codes (ISO 3166-1 numeric simplified)
const COUNTRY_US = 1;
const COUNTRY_UK = 44;
const COUNTRY_BLOCKED = 99;

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "PrivateKYC"
  )) as PrivateKYC__factory;
  // Allow US and UK initially
  const kyc = (await factory.deploy([COUNTRY_US, COUNTRY_UK])) as PrivateKYC;
  const kycAddress = await kyc.getAddress();

  return { kyc, kycAddress };
}

/**
 * Private KYC Tests
 *
 * Tests encrypted identity verification and predicate proofs.
 * Demonstrates privacy-preserving KYC without revealing personal data.
 */
describe("PrivateKYC", function () {
  let signers: Signers;
  let kyc: PrivateKYC;
  let kycAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      owner: ethSigners[0],
      user1: ethSigners[1],
      user2: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ kyc, kycAddress } = await deployFixture());
  });

  describe("Initialization", function () {
    it("should initialize with correct owner", async function () {
      expect(await kyc.owner()).to.equal(signers.owner.address);
    });

    it("should set allowed countries from constructor", async function () {
      expect(await kyc.isCountryAllowed(COUNTRY_US)).to.be.true;
      expect(await kyc.isCountryAllowed(COUNTRY_UK)).to.be.true;
      expect(await kyc.isCountryAllowed(COUNTRY_BLOCKED)).to.be.false;
    });

    it("should have correct age constants", async function () {
      expect(await kyc.MIN_AGE_ADULT()).to.equal(18);
      expect(await kyc.MIN_AGE_DRINKING_US()).to.equal(21);
    });
  });

  describe("KYC Submission", function () {
    it("should allow user to submit encrypted KYC", async function () {
      // 🔐 Encrypt personal data locally:
      // We bundle age, country, and credit score into a single encrypted input.
      const enc = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25) // age
        .add8(COUNTRY_US) // country
        .add16(750) // credit score
        .encrypt();

      await expect(
        kyc
          .connect(signers.user1)
          .submitKYC(
            enc.handles[0],
            enc.handles[1],
            enc.handles[2],
            enc.inputProof
          )
      )
        .to.emit(kyc, "KYCSubmitted")
        .withArgs(signers.user1.address);

      expect(await kyc.hasSubmittedKYC(signers.user1.address)).to.be.true;
    });

    it("should prevent duplicate KYC submission", async function () {
      const enc1 = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25)
        .add8(COUNTRY_US)
        .add16(750)
        .encrypt();

      await kyc
        .connect(signers.user1)
        .submitKYC(
          enc1.handles[0],
          enc1.handles[1],
          enc1.handles[2],
          enc1.inputProof
        );

      const enc2 = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(30)
        .add8(COUNTRY_UK)
        .add16(800)
        .encrypt();

      await expect(
        kyc
          .connect(signers.user1)
          .submitKYC(
            enc2.handles[0],
            enc2.handles[1],
            enc2.handles[2],
            enc2.inputProof
          )
      ).to.be.revertedWith("Already verified");
    });

    it("should allow user to revoke their KYC", async function () {
      const enc = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25)
        .add8(COUNTRY_US)
        .add16(750)
        .encrypt();

      await kyc
        .connect(signers.user1)
        .submitKYC(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.inputProof
        );

      await expect(kyc.connect(signers.user1).revokeKYC())
        .to.emit(kyc, "KYCRevoked")
        .withArgs(signers.user1.address);

      expect(await kyc.hasSubmittedKYC(signers.user1.address)).to.be.false;
    });
  });

  describe("Age Verification", function () {
    beforeEach(async function () {
      // User1: 25 years old (adult)
      const enc1 = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25)
        .add8(COUNTRY_US)
        .add16(750)
        .encrypt();

      await kyc
        .connect(signers.user1)
        .submitKYC(
          enc1.handles[0],
          enc1.handles[1],
          enc1.handles[2],
          enc1.inputProof
        );

      // User2: 17 years old (minor)
      const enc2 = await fhevm
        .createEncryptedInput(kycAddress, signers.user2.address)
        .add8(17)
        .add8(COUNTRY_US)
        .add16(0)
        .encrypt();

      await kyc
        .connect(signers.user2)
        .submitKYC(
          enc2.handles[0],
          enc2.handles[1],
          enc2.handles[2],
          enc2.inputProof
        );
    });

    it("should return encrypted result for age verification", async function () {
      // 🛡️ Predicate Verification:
      // Calling `verifyAge18` returns an encrypted boolean (`ebool`) handle.
      // The caller knows *that* the verification was performed, but not the result yet.
      const result = await kyc.verifyAge18.staticCall(signers.user1.address);
      expect(result).to.not.equal(0n);
    });

    it("should verify 21+ for adult user", async function () {
      const result = await kyc.verifyAge21.staticCall(signers.user1.address);
      expect(result).to.not.equal(0n);
    });

    it("should verify custom age threshold", async function () {
      const result = await kyc.verifyAgeAbove.staticCall(
        signers.user1.address,
        20
      );
      expect(result).to.not.equal(0n);
    });
  });

  describe("Credit Score Verification", function () {
    beforeEach(async function () {
      // User1: credit score 750 (good)
      const enc1 = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25)
        .add8(COUNTRY_US)
        .add16(750)
        .encrypt();

      await kyc
        .connect(signers.user1)
        .submitKYC(
          enc1.handles[0],
          enc1.handles[1],
          enc1.handles[2],
          enc1.inputProof
        );
    });

    it("should verify good credit (700+)", async function () {
      const result = await kyc.verifyGoodCredit.staticCall(
        signers.user1.address
      );
      expect(result).to.not.equal(0n);
    });

    it("should verify credit above custom threshold", async function () {
      const result = await kyc.verifyCreditAbove.staticCall(
        signers.user1.address,
        600
      );
      expect(result).to.not.equal(0n);
    });
  });

  describe("Combined Verification", function () {
    beforeEach(async function () {
      const enc = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25)
        .add8(COUNTRY_US)
        .add16(750)
        .encrypt();

      await kyc
        .connect(signers.user1)
        .submitKYC(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.inputProof
        );
    });

    it("should verify adult with good credit combined", async function () {
      const result = await kyc.verifyAdultWithGoodCredit.staticCall(
        signers.user1.address
      );
      expect(result).to.not.equal(0n);
    });
  });

  describe("Decryptable Verification", function () {
    beforeEach(async function () {
      const enc = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25)
        .add8(COUNTRY_US)
        .add16(750)
        .encrypt();

      await kyc
        .connect(signers.user1)
        .submitKYC(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.inputProof
        );
    });

    it("should request age verification with event", async function () {
      await expect(kyc.requestAgeVerification(signers.user1.address, 18))
        .to.emit(kyc, "AgeVerificationRequested")
        .withArgs(signers.user1.address, 18);
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to update country allowlist", async function () {
      await expect(kyc.setCountryAllowed(COUNTRY_BLOCKED, true))
        .to.emit(kyc, "CountryAllowlistUpdated")
        .withArgs(COUNTRY_BLOCKED, true);

      expect(await kyc.isCountryAllowed(COUNTRY_BLOCKED)).to.be.true;
    });

    it("should allow batch country update", async function () {
      await kyc.setCountriesAllowed([50, 51, 52], true);

      expect(await kyc.isCountryAllowed(50)).to.be.true;
      expect(await kyc.isCountryAllowed(51)).to.be.true;
      expect(await kyc.isCountryAllowed(52)).to.be.true;
    });

    it("should prevent non-owner from updating allowlist", async function () {
      await expect(
        kyc.connect(signers.user1).setCountryAllowed(COUNTRY_BLOCKED, true)
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("View Functions", function () {
    it("should return verification time", async function () {
      const enc = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25)
        .add8(COUNTRY_US)
        .add16(750)
        .encrypt();

      await kyc
        .connect(signers.user1)
        .submitKYC(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.inputProof
        );

      const verifiedAt = await kyc.getVerificationTime(signers.user1.address);
      expect(verifiedAt).to.be.greaterThan(0n);
    });

    it("should allow user to get own identity handles", async function () {
      const enc = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25)
        .add8(COUNTRY_US)
        .add16(750)
        .encrypt();

      await kyc
        .connect(signers.user1)
        .submitKYC(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.inputProof
        );

      const identity = await kyc.connect(signers.user1).getMyIdentity();
      expect(identity.age).to.not.equal(0n);
      expect(identity.countryCode).to.not.equal(0n);
      expect(identity.creditScore).to.not.equal(0n);
    });

    it("should prevent non-verified user from getting identity", async function () {
      await expect(
        kyc.connect(signers.user1).getMyIdentity()
      ).to.be.revertedWith("No KYC submitted");
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    it("should reject revoke for non-submitted user", async function () {
      await expect(kyc.connect(signers.user1).revokeKYC()).to.be.revertedWith(
        "No KYC submitted"
      );
    });

    it("should reject age verification for unsubmitted user", async function () {
      await expect(
        kyc.verifyAge18.staticCall(signers.user1.address)
      ).to.be.revertedWith("No KYC submitted");
    });

    it("should accept KYC from blocked country (validation happens at verification)", async function () {
      // Submit KYC with blocked country
      const enc = await fhevm
        .createEncryptedInput(kycAddress, signers.user1.address)
        .add8(25)
        .add8(COUNTRY_BLOCKED) // Blocked country
        .add16(750)
        .encrypt();

      // Contract accepts encrypted data without validation
      await expect(
        kyc
          .connect(signers.user1)
          .submitKYC(
            enc.handles[0],
            enc.handles[1],
            enc.handles[2],
            enc.inputProof
          )
      ).to.not.be.reverted;
    });
  });
});
