const { expectRevert, BN } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const ERC20 = artifacts.require("ERC20Demo");
const AlohaSale = artifacts.require("AlohaPrivateSaleMock");

let snapshotId;

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

restoreSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: "2.0", method: "evm_revert", params: [snapshotId]}, () => {
      resolve();
    });
  })
}

takeSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: "2.0", method: "evm_snapshot"}, (err, result) => {
      snapshotId = result.result;
      resolve();
    });
  })
}

contract('Aloha Private Sale', function (accounts) {
  beforeEach(async function () {    
    this.erc20 = await ERC20.new({from: accounts[0]});
    this.sale = await AlohaSale.new(
      this.erc20.address,
      accounts[3],
      {from: accounts[0]}
    );
    this.erc20.transfer(this.sale.address, '10000000000000000000000000', {from: accounts[0]});
    await this.sale.mock_setSoftCapAndHardCap(new BN('5000000000000000000'), new BN('700000000000000000000'));
    await takeSnapshot();
  });

  afterEach(async function () {    
    await restoreSnapshot();
  });
  
  describe('when softcap reached and time ends', function () {
    it('should buy and distribute', async function () {
      let originalBalance = (await web3.eth.getBalance(accounts[3]));
      await this.sale.sendTransaction({from:accounts[1], value:5000000000000000000});
      assert.equal((await web3.eth.getBalance(accounts[3])).valueOf(), parseInt(originalBalance) + 5000000000000000000, "Incorrect eth value");
      assert.equal((await this.sale.getClaimableTokens(accounts[1])).valueOf(), 125000000000000000000000, "125k wasn't in the first account");
      // ToDo Check eth
      await expectRevert(
        this.sale.claim({from:accounts[1]}),
          'revert'
      );

      await this.sale.enableClaim({from: accounts[0]});

      await this.sale.claim({from:accounts[1]});
      assert.equal((await this.sale.getClaimableTokens(accounts[1])).valueOf(), 0, "0 wasn't in the first account");
      assert.equal((await this.erc20.balanceOf(accounts[1])).valueOf(), 125000000000000000000000, "125k wasn't in the first account");
    });
  });

  describe('when normal sale', function () {
    it('should fail if value is less than 0.1 eth', async function () {
      await expectRevert(
        this.sale.sendTransaction({from:accounts[1], value:90000000000000000}),
          'Min 0.1 eth'
      );
    });
  });
});
