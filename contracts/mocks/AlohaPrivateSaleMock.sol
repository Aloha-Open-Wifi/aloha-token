pragma solidity 0.6.4;

import "../AlohaPrivateSale.sol";

// This contract is for testing purposes only
contract AlohaPrivateSaleMock is AlohaPrivateSale {

    constructor (IERC20 _token, address payable funding) public AlohaPrivateSale(_token, funding) {
    }

    function mock_setSoftCapAndHardCap(uint256 mockSoftcap, uint256 mockHardcap) external {
        minimalGoal = mockSoftcap;
        hardCap = mockHardcap;
    }
}