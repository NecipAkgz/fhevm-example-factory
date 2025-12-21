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
 * @dev Flow: submitKYC() → verifyAge18()/verifyGoodCredit()/etc.
 *      Returns encrypted booleans: "Is 18+?", "Good credit?" without revealing actual values.
 *      ⚠️ Production KYC needs trusted attesters!
 */
contract PrivateKYC is ZamaEthereumConfig {
    struct Identity {
        euint8 age; // 0-255 years
        euint8 countryCode; // ISO 3166-1 numeric (1-255)
        euint16 creditScore; // 0-65535
        bool isVerified; // Has submitted KYC
        uint256 verifiedAt; // Timestamp of verification
    }

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

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier hasKYC(address user) {
        require(_identities[user].isVerified, "No KYC submitted");
        _;
    }

    /// @notice Creates the KYC contract
    /// @param _allowedCountryCodes Initial list of allowed country codes
    constructor(uint8[] memory _allowedCountryCodes) {
        owner = msg.sender;

        // Initialize allowed countries
        for (uint256 i = 0; i < _allowedCountryCodes.length; i++) {
            allowedCountries[_allowedCountryCodes[i]] = true;
        }
    }

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
