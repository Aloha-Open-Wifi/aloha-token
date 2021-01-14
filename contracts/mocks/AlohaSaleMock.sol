pragma solidity 0.6.4;

import "../AlohaSale.sol";

// This contract is for testing purposes only
contract AlohaSaleMock is AlohaSale {

    constructor (ERC20Burnable _token) public AlohaSale(_token) {
    }

    function mock_setSoftCapAndHardCap(uint256 mockSoftcap, uint256 mockHardcap) external {
        minimalGoal = mockSoftcap;
        hardCap = mockHardcap;
    }
}