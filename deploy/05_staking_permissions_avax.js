module.exports = async ({ getNamedAccounts, deployments }) => {
    const {get, execute} = deployments;
    const {deployer} = await getNamedAccounts();

    const CHAIN_ID_TESTNET = {
        BSC: 10002,
        RINKEBY: 10001,
        POLYGON: 10009,
        AVAX: 10006,
        FANTOM: 10012,
    };

    const controllerAddress = '0x63d6C59E7b884FBFaBBff76696a3b1c9742C9cF5'; // CHANGE to Fantom controller address

    // allow polygon controller to call bsc proxy
    await execute('StakingRewardsProxy', { from: deployer }, 'setTrustedRemote', CHAIN_ID_TESTNET['FANTOM'], controllerAddress);
};

module.exports.tags = ['StakingPermissionsAvax'];
