module.exports = async ({ getNamedAccounts, deployments }) => {
    const {deploy, get} = deployments;
    const {deployer} = await getNamedAccounts();

    const endpointAddress = '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706'; // LZ avax endpoint
    const controllerAddress = '0x63d6C59E7b884FBFaBBff76696a3b1c9742C9cF5'; // CHANGE to Fantom controller address
    const fundAddress = '0x63d6C59E7b884FBFaBBff76696a3b1c9742C9cF5'; // Address holding RADAR tokens for rewards
    const stakingToken = '0x11395616Ed308f9965a37D80d3bfd3b5910ffbb7'; // RADAR on avax

    let proxy = await deploy('StakingRewardsProxy', {
        from: deployer,
        args: [
            endpointAddress,
            fundAddress,
            controllerAddress,
            stakingToken
        ],
        log: true,
    });
    console.log('Proxy address: ' + proxy.address);
};

module.exports.tags = ['StakingRewardsProxy'];
