const {expect} = require("chai");
const {ethers} = require("hardhat");
const { keccak256 } = require("@ethersproject/keccak256");
const { toUtf8Bytes } = require("@ethersproject/strings");
const privateKey = require("./privateKey");
const signer = require("../libs/signer");

function increaseTime(seconds) {
    ethers.provider.send("evm_increaseTime", [seconds]);
    ethers.provider.send("evm_mine");
}

console.log('Test staking rewards LZ');

const srcChainId = 10006; // polygon mumbai testnet
const dstChainId = 10012; // bsc testnet

const tenTokens = ethers.utils.parseEther("10").toString();
const hundredTokens = ethers.utils.parseEther("100").toString();

describe.only("Staking Rewards", () => {
    beforeEach(async () => {
        const users = await hre.ethers.getSigners();
        users.forEach((user, index) => {
            user.privateKey = privateKey(index).slice(2);
        });

        [owner, distributor, alice, bob, mpcSigner] = users;

        const MockERC20 = await ethers.getContractFactory("MockERC20");

        rewardsToken = await MockERC20.deploy(owner.address);
        await rewardsToken.mint(owner.address, hundredTokens);
        await rewardsToken.mint(alice.address, hundredTokens);
        await rewardsToken.mint(bob.address, hundredTokens);

        const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock");
        lzEndpointMockSrc = await LZEndpointMock.deploy(srcChainId);
        lzEndpointMockDst = await LZEndpointMock.deploy(dstChainId);

        const StakingRewardsController = await ethers.getContractFactory(
            "StakingRewardsController"
        );

        stakingRewardsController = await StakingRewardsController.deploy(
            owner.address,
            10, //rewardPerSecond
            lzEndpointMockDst.address
        );
        console.log('Controller address: ' + stakingRewardsController.address);

        const StakingRewardsProxy = await ethers.getContractFactory(
            "StakingRewardsProxy"
        );
        stakingRewardsProxy = await StakingRewardsProxy.deploy(
            lzEndpointMockSrc.address,
            bob.address,
            stakingRewardsController.address,
            rewardsToken.address
        );
        console.log('proxy address: ' + stakingRewardsProxy.address);

        await rewardsToken.connect(bob).approve(stakingRewardsProxy.address, tenTokens);

        // Fund with some eth to be able to pay for layer zero calls
        await owner.sendTransaction({
            value: 10,
            to: stakingRewardsProxy.address,
        });

        await owner.sendTransaction({
            value: 10,
            to: stakingRewardsController.address,
        });

        lzEndpointMockSrc.setDestLzEndpoint(
            stakingRewardsController.address,
            lzEndpointMockDst.address
        );
        lzEndpointMockDst.setDestLzEndpoint(
            stakingRewardsProxy.address,
            lzEndpointMockSrc.address
        );

        // set each contracts source address so it can send to each other
        await stakingRewardsController.setTrustedRemote(
            srcChainId,
            stakingRewardsProxy.address
        );

        await stakingRewardsProxy.setTrustedRemote(
            dstChainId,
            stakingRewardsController.address
        );
    });

    describe("Test staking through LayerZero", () => {
        it("fund rewards", async () => {
            // Stake & wait 1 day
            await rewardsToken.connect(alice).approve(stakingRewardsProxy.address, tenTokens);
            let signature = signer(alice.privateKey, {action: 'stake', amount: tenTokens}); // 10**11
            await stakingRewardsController.connect(owner).setRewardPerSecond(10);
            await stakingRewardsProxy.connect(alice).stake(tenTokens, signature);

            expect(await rewardsToken.balanceOf(stakingRewardsProxy.address)).to.equal("10000000000000000000");

            increaseTime(60 * 60 * 24); // increase time by 1 day
            expect(await stakingRewardsController.pendingRewards(alice.address)).to.equal(864000);

            // Double rewardPerSecond, wait 1 day and check pending rewards (should have 3x rewards now)
            await stakingRewardsController.updatePool(); //hit updatePool before updating rewardPerSecond to not skew rewards
            await stakingRewardsController.connect(owner).setRewardPerSecond(20);

            increaseTime(60 * 60 * 24);
            expect(await stakingRewardsController.pendingRewards(alice.address)).to.equal(2592030);

            // Stake more to check if cumulative staking works well
            await rewardsToken.connect(alice).approve(stakingRewardsProxy.address, tenTokens);
            signature = signer(alice.privateKey, {action: 'stake', amount: tenTokens});
            await stakingRewardsProxy.connect(alice).stake(tenTokens, signature);

            increaseTime(60 * 60 * 24);
            expect(await stakingRewardsController.pendingRewards(alice.address)).to.equal("6912140");

            // Claim rewards
            signature = signer(alice.privateKey, {action: 'claim', amount: "0"});
            await stakingRewardsProxy.connect(alice).claim(signature);
            expect(await rewardsToken.balanceOf(alice.address)).to.equal("80000000000006912160");
            expect(await rewardsToken.balanceOf(stakingRewardsProxy.address)).to.equal("20000000000000000000");
            expect(await stakingRewardsController.pendingRewards(alice.address)).to.equal(0);

            // Withdraw stake
            signature = signer(alice.privateKey, {action: 'withdraw', amount: "0"});
            await stakingRewardsProxy.connect(alice).withdraw(signature);
            expect(await rewardsToken.balanceOf(alice.address)).to.equal("100000000000006912180");

            // Emergency withdraw
            await rewardsToken.connect(alice).approve(stakingRewardsProxy.address, tenTokens);
            signature = signer(alice.privateKey, {action: 'stake', amount: tenTokens});
            await stakingRewardsProxy.connect(alice).stake(tenTokens, signature);
            expect(await rewardsToken.balanceOf(stakingRewardsProxy.address)).to.equal(tenTokens);
            await stakingRewardsProxy.connect(owner).emergency();
            await stakingRewardsProxy.connect(alice).emergencyWithdraw();
            expect(await rewardsToken.balanceOf(stakingRewardsProxy.address)).to.equal("0");
            expect(await rewardsToken.balanceOf(alice.address)).to.equal("100000000000006912180");
        });
    });
});
