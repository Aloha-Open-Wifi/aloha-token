pragma solidity 0.6.4;

import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";
import '../node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

contract AlohaSale is ReentrancyGuard, Ownable {
    using SafeMath for uint256;

    // Participants for posible refunds
    mapping(address => uint256) participants;

    mapping(address => uint256) public claimableTokens;

    // ALOHA per ETH price
    uint256 buyPrice;
    uint256 minimalGoal;
    uint256 hardCap;

    ERC20Burnable crowdsaleToken;

    uint256 tokenDecimals = 18;

    event SellToken(address recepient, uint tokensSold, uint value);

    address payable fundingAddress;
    uint256 startTimestamp;
    uint256 endTimestamp;
    bool started;
    bool stopped;
    uint256 totalCollected;
    uint256 totalSold;
    bool claimEnabled = false;
    uint256 claimWaitTime = 2 days;


    /**
    44.444,4444444 for Presale 
    Buy price: 45000000000000000 wei | 0.045 eth
    */
    constructor(
        ERC20Burnable _token
    ) public {
        minimalGoal = 400000000000000000000;
        hardCap = 2000000000000000000000;
        buyPrice = 50000000000000;
        crowdsaleToken = _token;
    }

    function getToken()
    external
    view
    returns(address)
    {
        return address(crowdsaleToken);
    }

    function getClaimableTokens(address wallet)
    external 
    view
    returns(uint256)
    {
      return claimableTokens[wallet];
    }

    receive() external payable {
        require(msg.value >= 100000000000000000, "Min 0.1 eth");
        sell(msg.sender, msg.value);
    }

    // For users to claim their tokens after a successful tge
    function claim() external 
      nonReentrant 
      hasntStopped()
      whenCrowdsaleSuccessful()
    returns (uint256) {
        require(claimEnabled || block.timestamp > (endTimestamp + claimWaitTime), "Claim is not yet possible");
        uint256 amount = claimableTokens[msg.sender];
        claimableTokens[msg.sender] = 0;
        require(crowdsaleToken.transfer(msg.sender, amount), "Error transfering");
        return amount;
    }

    function sell(address payable _recepient, uint256 _value) internal
        nonReentrant
        hasBeenStarted()
        hasntStopped()
        whenCrowdsaleAlive()
    {
        uint256 newTotalCollected = totalCollected.add(_value);

        if (hardCap < newTotalCollected) {
            // Refund anything above the hard cap
            uint256 refund = newTotalCollected.sub(hardCap);
            uint256 diff = _value.sub(refund);
            _recepient.transfer(refund);
            _value = diff;
            newTotalCollected = totalCollected.add(_value);
        }

        // Token amount per price
        uint256 tokensSold = (_value).div(buyPrice).mul(10 ** tokenDecimals);


        // Set how much tokens the user can claim
        claimableTokens[_recepient] = claimableTokens[_recepient].add(tokensSold);

        emit SellToken(_recepient, tokensSold, _value);

        // Save participants in case of a refund
        participants[_recepient] = participants[_recepient].add(_value);

        // Update total ETH
        totalCollected = totalCollected.add(_value);

        // Update tokens sold
        totalSold = totalSold.add(tokensSold);
    }

    function enableClaim(
    )
    external
    onlyOwner()
    {
        claimEnabled = true;
    }

    // Called to withdraw the ETH only if the TGE was successful
    function withdraw(
        uint256 _amount
    )
    external
    nonReentrant
    onlyOwner()
    hasntStopped()
    whenCrowdsaleSuccessful()
    {
        require(_amount <= address(this).balance, "Not enough funds");
        fundingAddress.transfer(_amount);
    }

    function burnUnsold()
    external
    nonReentrant
    onlyOwner()
    hasntStopped()
    whenCrowdsaleSuccessful()
    {
        crowdsaleToken.burn(crowdsaleToken.balanceOf(address(this)));
    }

    // Called to refund user's ETH if the TGE has failed
    function refund()
    external
    nonReentrant
    {
        require(stopped || isFailed(), "Not cancelled or failed");
        uint256 amount = participants[msg.sender];

        require(amount > 0, "Only once");
        participants[msg.sender] = 0;

        msg.sender.transfer(amount);
    }

  // Cancels the TGE
  function stop() public onlyOwner() hasntStopped()  {
    if (started) {
      require(!isFailed());
      require(!isSuccessful());
    }
    stopped = true;
  }

  // Called to setup start and end time of TGE as well as funding address
  function start(
    uint256 _startTimestamp,
    uint256 _endTimestamp,
    address payable _fundingAddress
  )
    public
    onlyOwner()
    hasntStarted()
    hasntStopped()
  {
    require(_fundingAddress != address(0));
    require(_endTimestamp > _startTimestamp);
    require(crowdsaleToken.balanceOf(address(this)) >= hardCap.div(buyPrice).mul(10 ** tokenDecimals), "Not enough tokens transfered for the sale");

    startTimestamp = _startTimestamp;
    endTimestamp = _endTimestamp;
    fundingAddress = _fundingAddress;
    started = true;
  }

  function getTime()
    public
    view
    returns(uint256)
  {
    return block.timestamp;
  }

  function isFailed()
    public
    view
    returns(bool)
  {
    return (
      started &&
      block.timestamp >= endTimestamp &&
      totalCollected < minimalGoal
    );
  }

  function isActive()
    public
    view
    returns(bool)
  {
    return (
      started &&
      totalCollected < hardCap &&
      block.timestamp >= startTimestamp &&
      block.timestamp < endTimestamp
    );
  }

  function isSuccessful()
    public
    view
    returns(bool)
  {
    return (
      totalCollected >= hardCap ||
      (block.timestamp >= endTimestamp && totalCollected >= minimalGoal)
    );
  }

  modifier whenCrowdsaleAlive() {
    require(isActive());
    _;
  }

  modifier whenCrowdsaleSuccessful() {
    require(isSuccessful());
    _;
  }

  modifier hasntStopped() {
    require(!stopped);
    _;
  }

  modifier hasntStarted() {
    require(!started);
    _;
  }

  modifier hasBeenStarted() {
    require(started);
    _;
  }
}