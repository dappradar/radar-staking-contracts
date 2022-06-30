module.exports = async ({ getNamedAccounts, deployments }) => {
    const {deploy, get} = deployments;
    const {deployer} = await getNamedAccounts();

    const endpointAddress = '0x3c2269811836af69497E5F486A85D7316753cf62'; // LZ BSC endpoint
    const controllerAddress = '0x9cAe64fBD251C47Df15f7b33f7864bB98EE83695'; // CHANGE to Fantom controller address
    const owner = '0x04e3433f9B0e9fED67e895180e86FcBF2dA2A63C';
    const fundAddress = '0x04e3433f9B0e9fED67e895180e86FcBF2dA2A63C'; // Address holding RADAR tokens for rewards
    const stakingToken = '0x489580eB70a50515296eF31E8179fF3e77E24965'; // RADAR on BSC

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

module.exports.tags = ['StakingRewardsProxyBsc'];
