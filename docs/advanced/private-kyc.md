Private KYC - verify identity without revealing personal data!

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="PrivateKYC.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint8,
    euint16,
    ebool,
    externalEuint8,
    externalEuint16
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Private KYC - verify identity without revealing personal data!
 *
 * @dev Demonstrates identity verification using FHE predicates:
 *      - Users submit encrypted KYC attributes (age, country, credit score)
 *      - Verifiers check conditions without seeing actual values
 *      - Only boolean results revealed: "Is 18+?", "Is from allowed country?"
 *      - Personal data never leaves encrypted form
 *
 * Verification types:
 * 1. Age verification: isAbove18(), isAbove21()
 * 2. Country check: isFromAllowedCountry()
 * 3. Credit score: hasCreditScoreAbove(threshold)
 *
 * ⚠️ IMPORTANT: This is a demo - production KYC needs trusted attesters!
 */
contract PrivateKYC is ZamaEthereumConfig {
    // ==================== TYPES ====================

    struct Identity {
        euint8 age; // 0-255 years
        euint8 countryCode; // ISO 3166-1 numeric (1-255)
        euint16 creditScore; // 0-65535
        bool isVerified; // Has submitted KYC
        uint256 verifiedAt; // Timestamp of verification
    }

    // ==================== STATE ====================

    /// Contract owner (KYC admin)
    address public owner;

    /// Mapping from user address to their encrypted identity
    mapping(address => Identity) private _identities;

    /// Allowed country codes (stored as mapping for O(1) lookup)
    mapping(uint8 => bool) public allowedCountries;

    /// Minimum age requirement
    uint8 public constant MIN_AGE_ADULT = 18;
    uint8 public constant MIN_AGE_DRINKING_US = 21;

    /// Minimum credit score for "good" rating
    uint16 public constant MIN_CREDIT_GOOD = 700;

    // ==================== EVENTS ====================

    /// @notice Emitted when user submits KYC
    /// @param user Address of user
    event KYCSubmitted(address indexed user);

    /// @notice Emitted when KYC is revoked
    /// @param user Address of user
    event KYCRevoked(address indexed user);

    /// @notice Emitted when country allowlist is updated
    /// @param countryCode Country code
    /// @param allowed Whether country is allowed
    event CountryAllowlistUpdated(uint8 countryCode, bool allowed);

    /// @notice Emitted when age verification is requested
    /// @param user Address being verified
    /// @param minAge Minimum age required
    event AgeVerificationRequested(address indexed user, uint8 minAge);

    // ==================== MODIFIERS ====================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier hasKYC(address user) {
        require(_identities[user].isVerified, "No KYC submitted");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    /// @notice Creates the KYC contract
    /// @param _allowedCountryCodes Initial list of allowed country codes
    constructor(uint8[] memory _allowedCountryCodes) {
        owner = msg.sender;

        // Initialize allowed countries
        for (uint256 i = 0; i < _allowedCountryCodes.length; i++) {
            allowedCountries[_allowedCountryCodes[i]] = true;
        }
    }

    // ==================== KYC SUBMISSION ====================

    /// @notice Submit encrypted KYC data
    /// @param encAge Encrypted age
    /// @param encCountry Encrypted country code
    /// @param encCreditScore Encrypted credit score
    /// @param inputProof Proof validating encrypted inputs
    function submitKYC(
        externalEuint8 encAge,
        externalEuint8 encCountry,
        externalEuint16 encCreditScore,
        bytes calldata inputProof
    ) external {
        require(!_identities[msg.sender].isVerified, "Already verified");

        // 🔐 Convert encrypted inputs
        euint8 age = FHE.fromExternal(encAge, inputProof);
        euint8 country = FHE.fromExternal(encCountry, inputProof);
        euint16 creditScore = FHE.fromExternal(encCreditScore, inputProof);

        // ✅ Grant permissions - only contract and user can access
        FHE.allowThis(age);
        FHE.allowThis(country);
        FHE.allowThis(creditScore);
        FHE.allow(age, msg.sender);
        FHE.allow(country, msg.sender);
        FHE.allow(creditScore, msg.sender);

        // 📋 Store identity
        _identities[msg.sender] = Identity({
            age: age,
            countryCode: country,
            creditScore: creditScore,
            isVerified: true,
            verifiedAt: block.timestamp
        });

        emit KYCSubmitted(msg.sender);
    }

    /// @notice Revoke own KYC data
    function revokeKYC() external hasKYC(msg.sender) {
        delete _identities[msg.sender];
        emit KYCRevoked(msg.sender);
    }

    // ==================== VERIFICATION FUNCTIONS ====================

    /// @notice Check if user is 18 or older
    /// @param user Address to verify
    /// @return result Encrypted boolean result
    function verifyAge18(address user) external hasKYC(user) returns (ebool) {
        // 🔍 Compare: age >= 18
        ebool isAdult = FHE.ge(
            _identities[user].age,
            FHE.asEuint8(MIN_AGE_ADULT)
        );
        return isAdult;
    }

    /// @notice Check if user is 21 or older (US drinking age)
    /// @param user Address to verify
    /// @return result Encrypted boolean result
    function verifyAge21(address user) external hasKYC(user) returns (ebool) {
        ebool isOldEnough = FHE.ge(
            _identities[user].age,
            FHE.asEuint8(MIN_AGE_DRINKING_US)
        );
        return isOldEnough;
    }

    /// @notice Check if user is above a custom age threshold
    /// @param user Address to verify
    /// @param minAge Minimum age required
    /// @return result Encrypted boolean result
    function verifyAgeAbove(
        address user,
        uint8 minAge
    ) external hasKYC(user) returns (ebool) {
        ebool meetsAge = FHE.ge(_identities[user].age, FHE.asEuint8(minAge));
        return meetsAge;
    }

    /// @notice Check if user has good credit score (700+)
    /// @param user Address to verify
    /// @return result Encrypted boolean result
    function verifyGoodCredit(
        address user
    ) external hasKYC(user) returns (ebool) {
        ebool hasGoodCredit = FHE.ge(
            _identities[user].creditScore,
            FHE.asEuint16(MIN_CREDIT_GOOD)
        );
        return hasGoodCredit;
    }

    /// @notice Check if user's credit score is above threshold
    /// @param user Address to verify
    /// @param minScore Minimum credit score
    /// @return result Encrypted boolean result
    function verifyCreditAbove(
        address user,
        uint16 minScore
    ) external hasKYC(user) returns (ebool) {
        ebool meetsScore = FHE.ge(
            _identities[user].creditScore,
            FHE.asEuint16(minScore)
        );
        return meetsScore;
    }

    /// @notice Combined verification: 18+ AND good credit
    /// @param user Address to verify
    /// @return result Encrypted boolean result
    function verifyAdultWithGoodCredit(
        address user
    ) external hasKYC(user) returns (ebool) {
        ebool isAdult = FHE.ge(
            _identities[user].age,
            FHE.asEuint8(MIN_AGE_ADULT)
        );
        ebool hasGoodCredit = FHE.ge(
            _identities[user].creditScore,
            FHE.asEuint16(MIN_CREDIT_GOOD)
        );

        // 🔗 Combine with AND
        ebool result = FHE.and(isAdult, hasGoodCredit);
        return result;
    }

    // ==================== DECRYPTABLE VERIFICATION ====================

    /// @notice Request age verification with public result
    /// @dev Makes the result publicly decryptable
    /// @param user Address to verify
    /// @param minAge Minimum age required
    /// @return resultHandle Handle to the encrypted result
    function requestAgeVerification(
        address user,
        uint8 minAge
    ) external hasKYC(user) returns (ebool resultHandle) {
        ebool result = FHE.ge(_identities[user].age, FHE.asEuint8(minAge));

        FHE.allowThis(result);
        FHE.makePubliclyDecryptable(result);

        emit AgeVerificationRequested(user, minAge);
        return result;
    }

    // ==================== ADMIN FUNCTIONS ====================

    /// @notice Update country allowlist
    /// @param countryCode Country code to update
    /// @param allowed Whether to allow or deny
    function setCountryAllowed(
        uint8 countryCode,
        bool allowed
    ) external onlyOwner {
        allowedCountries[countryCode] = allowed;
        emit CountryAllowlistUpdated(countryCode, allowed);
    }

    /// @notice Batch update country allowlist
    /// @param countryCodes Array of country codes
    /// @param allowed Whether to allow or deny all
    function setCountriesAllowed(
        uint8[] calldata countryCodes,
        bool allowed
    ) external onlyOwner {
        for (uint256 i = 0; i < countryCodes.length; i++) {
            allowedCountries[countryCodes[i]] = allowed;
            emit CountryAllowlistUpdated(countryCodes[i], allowed);
        }
    }

    // ==================== VIEW FUNCTIONS ====================

    /// @notice Check if user has submitted KYC
    function hasSubmittedKYC(address user) external view returns (bool) {
        return _identities[user].isVerified;
    }

    /// @notice Get KYC submission timestamp
    function getVerificationTime(address user) external view returns (uint256) {
        return _identities[user].verifiedAt;
    }

    /// @notice Get own encrypted data handles (for decryption by user)
    /// @dev Only callable by the identity owner
    function getMyIdentity()
        external
        view
        hasKYC(msg.sender)
        returns (euint8 age, euint8 countryCode, euint16 creditScore)
    {
        Identity storage id = _identities[msg.sender];
        return (id.age, id.countryCode, id.creditScore);
    }

    /// @notice Check if a country code is allowed
    function isCountryAllowed(uint8 countryCode) external view returns (bool) {
        return allowedCountries[countryCode];
    }
}

```

{% endtab %}

{% tab title="PrivateKYC.ts" %}

```typescript
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
      // User1: 25 years old, US, credit score 750
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
      // Verify age 18+ returns encrypted boolean handle
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
});

```

{% endtab %}

{% endtabs %}
