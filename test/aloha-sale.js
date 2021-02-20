const { expectRevert, BN } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const ERC20 = artifacts.require("ERC20Demo");
const AlohaSale = artifacts.require("AlohaSaleMock");

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

contract('Aloha Sale', function (accounts) {
  beforeEach(async function () {    
    this.erc20 = await ERC20.new({from: accounts[0]});
    this.sale = await AlohaSale.new(
      this.erc20.address,
        {from: accounts[0]}
    );
    this.erc20.transfer(this.sale.address, '32000000000000000000000000', {from: accounts[0]});
    const date = new Date();
    await this.sale.start(parseInt((date.getTime() / 1000)-10000), parseInt((date.getTime() / 1000)+10000), accounts[3], {from: accounts[0]});
    await this.sale.mock_setSoftCapAndHardCap(new BN('5000000000000000000'), new BN('700000000000000000000'));
    await takeSnapshot();
  });

  afterEach(async function () {    
    await restoreSnapshot();
  });

  describe('when softcap not reached and time ends', function () {
    it('should refund', async function () {
      assert.equal(await this.sale.isFailed(), false, "Failed is true");
      assert.equal(await this.sale.isSuccessful(), false, "Success is true");
      assert.equal(await this.sale.isActive(), true, "Active is false");

      await this.sale.sendTransaction({from:accounts[1], value:1000000000000000000});
      assert.equal((await this.sale.getClaimableTokens(accounts[1])).valueOf(), 20000000000000000000000, "20000 wasn't in the first account");


      assert.equal(await this.sale.isFailed(), false, "Failed is true");
      assert.equal(await this.sale.isSuccessful(), false, "Success is true");
      assert.equal(await this.sale.isActive(), true, "Active is false");

      await advanceTime(30000);

      assert.equal(await this.sale.isFailed(), true, "Failed is false");
      assert.equal(await this.sale.isSuccessful(), false, "Success is true");
      assert.equal(await this.sale.isActive(), false, "Active is true");

      await expectRevert(
        this.sale.claim({from:accounts[1]}),
          'revert'
      );
      // let originalBalance = (await web3.eth.getBalance(accounts[1]));
      const txnReceipt = await this.sale.refund({from:accounts[1]});
      // const gasUsed = txnReceipt.receipt.gasUsed;
      const tx = await web3.eth.getTransaction(txnReceipt.tx);
      // const gasPrice = tx.gasPrice;
      assert.equal((await web3.eth.getBalance(accounts[1])).valueOf(), '99996435860000000000', "Incorrect balance");

    });
  });
  
  describe('when softcap reached and time ends', function () {
    it('should buy and distribute', async function () {
      assert.equal(await this.sale.isFailed(), false, "Failed is true");
      assert.equal(await this.sale.isSuccessful(), false, "Success is true");
      assert.equal(await this.sale.isActive(), true, "Active is false");

      await this.sale.sendTransaction({from:accounts[1], value:5000000000000000000});
      assert.equal((await this.sale.getClaimableTokens(accounts[1])).valueOf(), 100000000000000000000000, "100k wasn't in the first account");


      assert.equal(await this.sale.isFailed(), false, "Failed is true");
      assert.equal(await this.sale.isSuccessful(), false, "Success is true");
      assert.equal(await this.sale.isActive(), true, "Active is false");

      await advanceTime(30000);

      assert.equal(await this.sale.isFailed(), false, "Failed is true");
      assert.equal(await this.sale.isSuccessful(), true, "Success is false");
      assert.equal(await this.sale.isActive(), false, "Active is true");

      await expectRevert(
        this.sale.claim({from:accounts[1]}),
          'revert'
      );

      // Let's go two days into the future. "Where we're going we don't need... roads!"
      await advanceTime(2 * 24 * 60 * 60);

      await this.sale.claim({from:accounts[1]});
      assert.equal((await this.sale.getClaimableTokens(accounts[1])).valueOf(), 0, "0 wasn't in the first account");
      assert.equal((await this.erc20.balanceOf(accounts[1])).valueOf(), 100000000000000000000000, "100k wasn't in the first account");
    });
  });

  describe('when hardcap reached', function () {
    it('should buy and distribute', async function () {
      await this.sale.sendTransaction({from:accounts[1], value:1000000000000000000});
      assert.equal((await this.sale.getClaimableTokens(accounts[1])).valueOf(), 20000000000000000000000, "20000 wasn't in the first account");
      await expectRevert(
        this.sale.claim({from:accounts[1]}),
          'revert'
      );
      assert.equal((await this.sale.getClaimableTokens(accounts[1])).valueOf(), 20000000000000000000000, "20000 wasn't in the first account");
      assert.equal((await this.erc20.balanceOf(accounts[1])).valueOf(), 0, "0 wasn't in the first account");

      await this.sale.sendTransaction({from:accounts[1], value:7000000000000000000});

      await this.sale.sendTransaction({from:accounts[2], value:1000000000000000000});
      assert.equal((await this.sale.getClaimableTokens(accounts[2])).valueOf(), 20000000000000000000000, "20000 wasn't in the second account");


      assert.equal(await this.sale.isFailed(), false, "Failed is true");
      assert.equal(await this.sale.isSuccessful(), false, "Success is true");
      assert.equal(await this.sale.isActive(), true, "Active is false");
      
      for (let i = 0; i < 9; i++) {
        await this.sale.sendTransaction({from:accounts[1], value:10000000000000000000});
        await this.sale.sendTransaction({from:accounts[2], value:10000000000000000000});
      }

      for (let i = 0; i < 10; i++) {
        await this.sale.sendTransaction({from:accounts[3], value:10000000000000000000});
        await this.sale.sendTransaction({from:accounts[4], value:10000000000000000000});
        await this.sale.sendTransaction({from:accounts[5], value:10000000000000000000});
        await this.sale.sendTransaction({from:accounts[6], value:10000000000000000000});
        if (await this.sale.isSuccessful()) {
          break;
        }

        await this.sale.sendTransaction({from:accounts[7], value:10000000000000000000});
        await this.sale.sendTransaction({from:accounts[8], value:10000000000000000000});
      }

      assert.equal((await this.sale.getClaimableTokens(accounts[1])).valueOf(), '1960000000000000000000000', "1960000 wasn't in the first account");
      await expectRevert(
        this.sale.claim({from:accounts[1]}),
          'revert'
      );
      await this.sale.enableClaim({from: accounts[0]});

      await this.sale.claim({from:accounts[1]});
      assert.equal((await this.sale.getClaimableTokens(accounts[1])).valueOf(), 0, "0 wasn't in the first account");
      assert.equal((await this.erc20.balanceOf(accounts[1])).valueOf(), 1960000000000000000000000, "1960000 wasn't in the first account");
      assert.equal(await this.sale.isFailed(), false, "Failed is true");
      assert.equal(await this.sale.isSuccessful(), true, "Success is false");
      assert.equal(await this.sale.isActive(), false, "Active is true");
    });
  });

  describe('when normal sale', function () {
    it('should fail if value is less than 0.1 eth', async function () {
      await expectRevert(
        this.sale.sendTransaction({from:accounts[1], value:90000000000000000}),
          'Min 0.1 eth'
      );
    });
    it('should fail if value is more than 10 eth', async function () {
      await expectRevert(
        this.sale.sendTransaction({from:accounts[1], value:10100000000000000000}),
          'Max 10 eth'
      );
    });
  });
});
