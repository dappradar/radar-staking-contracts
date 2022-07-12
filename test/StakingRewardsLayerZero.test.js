const {expect} = require("chai");
const {ethers} = require("hardhat");
const {keccak256} = require("@ethersproject/keccak256");
const {toUtf8Bytes} = require("@ethersproject/strings");
const privateKey = require("./privateKey");
const signer = require("../libs/signer");

function increaseTime(seconds) {
    ethers.provider.send("evm_increaseTime", [seconds]);
    ethers.provider.send("evm_mine");
}

console.log('Test staking rewards LZ');

const srcChainId = 2; // bsc
const dstChainId = 12; // fantom

const tenTokens = ethers.utils.parseEther("10").toString();
const hundredTokens = ethers.utils.parseEther("100").toString();
const millionTokens = ethers.utils.parseEther("1000000").toString();

describe.only("Staking Rewards", () => {
    beforeEach(async () => {
        const users = await hre.ethers.getSigners();
        users.forEach((user, index) => {
            user.privateKey = privateKey(index).slice(2);
        });

        [owner, distributor, alice, bob, mpcSigner] = users;

        const MockERC20 = await ethers.getContractFactory("MockERC20");

        rewardsToken = await MockERC20.deploy(owner.address);
        await rewardsToken.mint(owner.address, millionTokens);
        await rewardsToken.mint(alice.address, hundredTokens);
        await rewardsToken.mint(bob.address, millionTokens);

        const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock");
        lzEndpointMockSrc = await LZEndpointMock.deploy(srcChainId);
        lzEndpointMockDst = await LZEndpointMock.deploy(dstChainId);

        const StakingRewardsController = await ethers.getContractFactory(
            "StakingRewardsController"
        );

        stakingRewardsController = await StakingRewardsController.deploy(
            owner.address,
            "10000000000000000", //rewardPerSecond
            lzEndpointMockDst.address
        );
        console.log('Controller address: ' + stakingRewardsController.address);

        const StakingRewardsProxy = await ethers.getContractFactory(
            "StakingRewardsProxy"
        );
        stakingRewardsProxy = await StakingRewardsProxy.deploy(
            owner.address,
            lzEndpointMockSrc.address,
            bob.address,
            stakingRewardsController.address,
            rewardsToken.address
        );
        console.log('proxy address: ' + stakingRewardsProxy.address);

        await rewardsToken.connect(bob).approve(stakingRewardsProxy.address, millionTokens);

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
        it("Stake once", async () => {
            await rewardsToken.connect(owner).approve(stakingRewardsProxy.address, tenTokens);

            expect(await rewardsToken.balanceOf(alice.address)).to.equal(toWei("100"));
            await stake(alice, tenTokens);
            expect(await getBalanceOf(alice)).to.equal(tenTokens);
            expect(await rewardsToken.balanceOf(alice.address)).to.equal(toWei("90"));
        });

        it("Stake and withdraw", async () => {
            await stake(alice, tenTokens);
            expect(await getBalanceOf(alice)).to.equal(tenTokens);

            await withdraw(alice);
            expect(await getBalanceOf(alice)).to.equal(0);
            expect(await rewardsToken.balanceOf(alice.address)).to.equal(toWei("100.01"));
        });
    });

    async function stake(user, amount) {
        await rewardsToken.connect(user).approve(stakingRewardsProxy.address, amount);
        let signature = await signer(user.privateKey, {action: "stake", amount: amount}); // 10**11

        await stakingRewardsProxy.connect(user).stake(amount, signature, {value: ethers.utils.parseEther("1").toString()});
    }

    async function claim(user) {
        let signature = await signer(user.privateKey, {action: 'claim', amount: "0"}); // 10**11
        await stakingRewardsProxy.connect(user).claim(signature, "0", {value: ethers.utils.parseEther("1").toString()});
    }

    async function withdraw(user) {
        let signature = await signer(user.privateKey, {action: 'withdraw', amount: "0"}); // 10**11
        await stakingRewardsProxy.connect(user).withdraw(signature, "0", {value: ethers.utils.parseEther("1").toString()});
    }

    async function getPendingRewards(user) {
        return parseFloat(ethers.utils.formatEther(await stakingRewardsController.pendingRewards(user.address))).toFixed(2);
    }

    async function getBalanceOf(user) {
        return await stakingRewardsController["balanceOf(address)"](user.address);
    }

    function toEther(wei) {
        return ethers.utils.formatEther(wei);
    }

    function toWei(ether) {
        return ethers.utils.parseEther(ether);
    }
});
