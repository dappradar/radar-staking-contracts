module.exports = async ({ getNamedAccounts, deployments }) => {
    const {deploy, get} = deployments;
    const {deployer} = await getNamedAccounts();

    const radarToken = await get('RadarToken');

    let controller = await deploy('StakingRewardsController', {
        from: deployer,
        args: [
            '0xe2e1F875c8Db3a663576d4093564cE89c800f378', // owner: drk
            10, // token rewards per second
            '0x7dcAD72640F835B0FA36EFD3D6d3ec902C7E5acf', // fantom testnet endpoint
        ],
        log: true,
    });

    console.log('Controller address: ' + controller.address);
};

module.exports.tags = ['StakingRewardsController'];
