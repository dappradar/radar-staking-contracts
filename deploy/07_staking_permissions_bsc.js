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

    const CHAIN_ID_MAINNET = {
        BSC: 2,
        ETH: 1,
        POLYGON: 9,
        AVAX: 6,
        FANTOM: 12,
    };

    const controllerAddress = '0x9cAe64fBD251C47Df15f7b33f7864bB98EE83695'; // CHANGE to Fantom controller address

    // allow fantom controller to call bsc proxy
    await execute('StakingRewardsProxy', { from: deployer }, 'setTrustedRemote', CHAIN_ID_MAINNET['FANTOM'], controllerAddress);
};

module.exports.tags = ['StakingPermissionsBsc'];
