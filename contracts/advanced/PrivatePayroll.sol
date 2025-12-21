// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint64,
    ebool,
    externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Confidential payroll system with encrypted salaries.
 *         Employers can add employees with encrypted salary amounts. Each employee
 *         can decrypt only their own salary - other salaries remain hidden.
 *         Demonstrates selective decryption permissions where different users
 *         see different encrypted values. Perfect for privacy-preserving HR systems.
 *
 * @dev Flow: addEmployee() → fund() → processPayment()
 *      Each employee can decrypt only their own salary.
 */
contract PrivatePayroll is ZamaEthereumConfig {
    address public employer;

    /// List of employee addresses
    address[] public employees;

    /// Mapping from employee to their encrypted salary
    mapping(address => euint64) private _salaries;

    /// Whether an address is an employee
    mapping(address => bool) public isEmployee;

    /// Last payment timestamp per employee
    mapping(address => uint256) public lastPayment;

    /// Total encrypted salary sum (for budget tracking)
    euint64 private _totalSalaries;

    /// Payment period in seconds (default: 30 days)
    uint256 public paymentPeriod;

    /// Emitted when a new employee is added
    /// @param employee Address of the employee
    event EmployeeAdded(address indexed employee);

    /// @notice Emitted when an employee is removed
    /// @param employee Address of the removed employee
    event EmployeeRemoved(address indexed employee);

    /// @notice Emitted when salary is updated
    /// @param employee Address of the employee
    event SalaryUpdated(address indexed employee);

    /// @notice Emitted when payment is processed
    /// @param employee Address of paid employee
    /// @param timestamp Payment time
    event PaymentProcessed(address indexed employee, uint256 timestamp);

    /// @notice Emitted when contract is funded
    /// @param amount Amount funded
    event ContractFunded(uint256 amount);

    modifier onlyEmployer() {
        require(msg.sender == employer, "Only employer");
        _;
    }

    modifier onlyEmployee() {
        require(isEmployee[msg.sender], "Not an employee");
        _;
    }

    constructor(uint256 _paymentPeriod) {
        employer = msg.sender;
        paymentPeriod = _paymentPeriod > 0 ? _paymentPeriod : 30 days;
        _totalSalaries = FHE.asEuint64(0);
        FHE.allowThis(_totalSalaries);
    }

    /// @notice Add a new employee with encrypted salary
    /// @param employee Address of the employee
    /// @param encryptedSalary Encrypted salary amount
    /// @param inputProof Proof validating the encrypted input
    function addEmployee(
        address employee,
        externalEuint64 encryptedSalary,
        bytes calldata inputProof
    ) external onlyEmployer {
        require(employee != address(0), "Invalid address");
        require(!isEmployee[employee], "Already an employee");

        // 🔐 Convert external encrypted input
        euint64 salary = FHE.fromExternal(encryptedSalary, inputProof);

        // ✅ Grant permissions
        FHE.allowThis(salary);
        FHE.allow(salary, employee); // Employee can view their own salary

        // 📋 Store employee data
        _salaries[employee] = salary;
        isEmployee[employee] = true;
        employees.push(employee);

        // 📊 Update total
        _totalSalaries = FHE.add(_totalSalaries, salary);
        FHE.allowThis(_totalSalaries);

        emit EmployeeAdded(employee);
    }

    /// @notice Update an employee's salary
    /// @param employee Address of the employee
    /// @param encryptedSalary New encrypted salary amount
    /// @param inputProof Proof validating the encrypted input
    function updateSalary(
        address employee,
        externalEuint64 encryptedSalary,
        bytes calldata inputProof
    ) external onlyEmployer {
        require(isEmployee[employee], "Not an employee");

        // Get old salary for total adjustment
        euint64 oldSalary = _salaries[employee];

        // 🔐 Convert new salary
        euint64 newSalary = FHE.fromExternal(encryptedSalary, inputProof);

        // ✅ Grant permissions
        FHE.allowThis(newSalary);
        FHE.allow(newSalary, employee);

        // 📋 Update salary
        _salaries[employee] = newSalary;

        // 📊 Update total: subtract old, add new
        _totalSalaries = FHE.sub(_totalSalaries, oldSalary);
        _totalSalaries = FHE.add(_totalSalaries, newSalary);
        FHE.allowThis(_totalSalaries);

        emit SalaryUpdated(employee);
    }

    /// @notice Remove an employee
    /// @param employee Address to remove
    function removeEmployee(address employee) external onlyEmployer {
        require(isEmployee[employee], "Not an employee");

        // Get salary for total adjustment
        euint64 salary = _salaries[employee];

        // 📊 Update total
        _totalSalaries = FHE.sub(_totalSalaries, salary);
        FHE.allowThis(_totalSalaries);

        // Remove from list
        for (uint256 i = 0; i < employees.length; i++) {
            if (employees[i] == employee) {
                employees[i] = employees[employees.length - 1];
                employees.pop();
                break;
            }
        }

        // Clear data - euint64 cannot use delete, assign to zero instead
        _salaries[employee] = FHE.asEuint64(0);
        isEmployee[employee] = false;
        lastPayment[employee] = 0;

        emit EmployeeRemoved(employee);
    }

    /// @notice Fund the contract for payroll
    function fund() external payable onlyEmployer {
        require(msg.value > 0, "Must send funds");
        emit ContractFunded(msg.value);
    }

    /// @notice Process payment for a single employee
    /// @dev Requires decryption of salary - simplified for demo
    /// @param employee Address to pay
    /// @param abiEncodedSalary ABI-encoded salary amount
    /// @param decryptionProof KMS decryption proof
    function processPayment(
        address employee,
        bytes memory abiEncodedSalary,
        bytes memory decryptionProof
    ) external onlyEmployer {
        require(isEmployee[employee], "Not an employee");
        require(
            block.timestamp >= lastPayment[employee] + paymentPeriod,
            "Too early for next payment"
        );

        // Verify decryption
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(_salaries[employee]);
        FHE.checkSignatures(cts, abiEncodedSalary, decryptionProof);

        uint64 salaryAmount = abi.decode(abiEncodedSalary, (uint64));
        require(address(this).balance >= salaryAmount, "Insufficient funds");

        lastPayment[employee] = block.timestamp;

        // Transfer salary
        (bool sent, ) = employee.call{value: salaryAmount}("");
        require(sent, "Payment failed");

        emit PaymentProcessed(employee, block.timestamp);
    }

    /// @notice Get encrypted salary handle for employee
    /// @dev Only callable by the employee themselves
    function getMySalary() external view onlyEmployee returns (euint64) {
        return _salaries[msg.sender];
    }

    /// @notice Get encrypted total salaries handle
    /// @dev Only employer can access for budget planning
    function getTotalSalaries() external view onlyEmployer returns (euint64) {
        return _totalSalaries;
    }

    /// @notice Get number of employees
    function getEmployeeCount() external view returns (uint256) {
        return employees.length;
    }

    /// @notice Get employee at index
    function getEmployee(uint256 index) external view returns (address) {
        require(index < employees.length, "Index out of bounds");
        return employees[index];
    }

    /// @notice Check if payment is due for an employee
    function isPaymentDue(address employee) external view returns (bool) {
        if (!isEmployee[employee]) return false;
        return block.timestamp >= lastPayment[employee] + paymentPeriod;
    }

    /// @notice Get contract balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Get payroll info
    function getPayrollInfo()
        external
        view
        returns (uint256 employeeCount, uint256 balance, uint256 period)
    {
        return (employees.length, address(this).balance, paymentPeriod);
    }

    /// @notice Accept ETH deposits
    receive() external payable {
        emit ContractFunded(msg.value);
    }
}
