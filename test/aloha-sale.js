const { expectRevert, BN } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const ERC20 = artifacts.require("ERC20Demo");
const AlohaSale = artifacts.require("AlohaSaleMock");

advanceTime = (time) => {
  return new Promise((resolve, reject) => {
      web3.currentProvider.send({
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [time],
          id: new Date().getTime()
      }, (err, result) => {
          if (err) { return reject(err); }
          web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0}, () => {
            return resolve(result);
          })
      });
  });
}

contract('Aloha Sale', (accounts) => {
  let erc20;
  let contract;
  beforeEach(async function () {    
    erc20 = await ERC20.new({from: accounts[0]});
    contract = await AlohaSale.new(
        erc20.address,
        {from: accounts[0]}
    );
    erc20.transfer(contract.address, '40000000000000000000000000', {from: accounts[0]});
    const date = new Date();
    await contract.start(parseInt((date.getTime() / 1000)-10000), parseInt((date.getTime() / 1000)+10000), accounts[3], {from: accounts[0]});
    await contract.mock_setSoftCapAndHardCap(new BN('5000000000000000000'), new BN('700000000000000000000'));
  });
/*
  it('should refund when softcap not reached and time ends', async () => {


    assert.equal(await contract.isFailed(), false, "Failed is true");
    assert.equal(await contract.isSuccessful(), false, "Success is true");
    assert.equal(await contract.isActive(), true, "Active is false");

    await contract.sendTransaction({from:accounts[1], value:1000000000000000000});
    assert.equal((await contract.getClaimableTokens(accounts[1])).valueOf(), 22222222222222222222, "22,22 wasn't in the first account");


    assert.equal(await contract.isFailed(), false, "Failed is true");
    assert.equal(await contract.isSuccessful(), false, "Success is true");
    assert.equal(await contract.isActive(), true, "Active is false");

    await advanceTime(30000);

    assert.equal(await contract.isFailed(), true, "Failed is false");
    assert.equal(await contract.isSuccessful(), false, "Success is true");
    assert.equal(await contract.isActive(), false, "Active is true");

    await expectRevert(
      contract.claim({from:accounts[1]}),
        'revert'
    );
    // ToDo Test refund
  });

  it('should buy and distribute when softcap reached and time ends', async () => {


    assert.equal(await contract.isFailed(), false, "Failed is true");
    assert.equal(await contract.isSuccessful(), false, "Success is true");
    assert.equal(await contract.isActive(), true, "Active is false");

    await contract.sendTransaction({from:accounts[1], value:5000000000000000000});
    assert.equal((await contract.getClaimableTokens(accounts[1])).valueOf(), 22222222222222222222, "22,22 wasn't in the first account");


    assert.equal(await contract.isFailed(), false, "Failed is true");
    assert.equal(await contract.isSuccessful(), false, "Success is true");
    assert.equal(await contract.isActive(), true, "Active is false");

    await advanceTime(30000);

    assert.equal(await contract.isFailed(), false, "Failed is true");
    assert.equal(await contract.isSuccessful(), true, "Success is false");
    assert.equal(await contract.isActive(), false, "Active is true");

    await expectRevert(
      contract.claim({from:accounts[1]}),
        'revert'
    );
  });
*/
  it('should buy and distribute when hardcap reached', async () => {
    await contract.sendTransaction({from:accounts[1], value:1000000000000000000});
    assert.equal((await contract.getClaimableTokens(accounts[1])).valueOf(), 20000000000000000000000, "20000 wasn't in the first account");
    await expectRevert(
      contract.claim({from:accounts[1]}),
        'revert'
    );
    assert.equal((await contract.getClaimableTokens(accounts[1])).valueOf(), 20000000000000000000000, "20000 wasn't in the first account");
    assert.equal((await erc20.balanceOf(accounts[1])).valueOf(), 0, "0 wasn't in the first account");

    await contract.sendTransaction({from:accounts[1], value:7000000000000000000});

    await contract.sendTransaction({from:accounts[2], value:1000000000000000000});
    assert.equal((await contract.getClaimableTokens(accounts[2])).valueOf(), 20000000000000000000000, "20000 wasn't in the second account");


    assert.equal(await contract.isFailed(), false, "Failed is true");
    assert.equal(await contract.isSuccessful(), false, "Success is true");
    assert.equal(await contract.isActive(), true, "Active is false");
    
    for (let i = 0; i < 9; i++) {
      await contract.sendTransaction({from:accounts[1], value:10000000000000000000});
      await contract.sendTransaction({from:accounts[2], value:10000000000000000000});
    }

    for (let i = 0; i < 10; i++) {
      await contract.sendTransaction({from:accounts[3], value:10000000000000000000});
      await contract.sendTransaction({from:accounts[4], value:10000000000000000000});
      await contract.sendTransaction({from:accounts[5], value:10000000000000000000});
      await contract.sendTransaction({from:accounts[6], value:10000000000000000000});
      if (await contract.isSuccessful()) {
        break;
      }

      await contract.sendTransaction({from:accounts[7], value:10000000000000000000});
      await contract.sendTransaction({from:accounts[8], value:10000000000000000000});
    }

    assert.equal((await contract.getClaimableTokens(accounts[1])).valueOf(), '1960000000000000000000000', "1960000 wasn't in the first account");
    await expectRevert(
      contract.claim({from:accounts[1]}),
        'revert'
    );
    await contract.enableClaim({from: accounts[0]});

    await contract.claim({from:accounts[1]});
    assert.equal((await contract.getClaimableTokens(accounts[1])).valueOf(), 0, "0 wasn't in the first account");
    assert.equal((await erc20.balanceOf(accounts[1])).valueOf(), 1960000000000000000000000, "1960000 wasn't in the first account");
    assert.equal(await contract.isFailed(), false, "Failed is true");
    assert.equal(await contract.isSuccessful(), true, "Success is false");
    assert.equal(await contract.isActive(), false, "Active is true");
  });

  it('should fail if value is less than 0.1 eth', async function () {
    await expectRevert(
      contract.sendTransaction({from:accounts[1], value:90000000000000000}),
        'Min 0.1 eth'
    );
  });
});
