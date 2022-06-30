module.exports = async ({ getNamedAccounts, deployments }) => {
    const {deploy, get} = deployments;
    const {deployer} = await getNamedAccounts();

    const endpointAddress = '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675'; // LZ BSC endpoint
    const controllerAddress = '0x9cAe64fBD251C47Df15f7b33f7864bB98EE83695'; // CHANGE to Fantom controller address
    const owner = '0xB78b464A624040FB515BA6cCC33afF46Fd9f059d';
    const fundAddress = '0xB78b464A624040FB515BA6cCC33afF46Fd9f059d'; // Address holding RADAR tokens for rewards
    const stakingToken = '0x44709a920fCcF795fbC57BAA433cc3dd53C44DbE'; // RADAR on BSC

    let proxy = await deploy('StakingRewardsProxy', {
        from: deployer,
        args: [
            owner,
            endpointAddress,
            fundAddress,
            controllerAddress,
            stakingToken
        ],
        log: true,
    });
    console.log('Proxy address: ' + proxy.address);
};

module.exports.tags = ['StakingRewardsProxyEth'];
