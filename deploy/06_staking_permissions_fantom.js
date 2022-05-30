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

    const proxyAddress = '0xAA7bc9AE7Ec2933b900626A47380f8e067E9e751'; // CHANGE to AVAX proxy

    // allow bsc proxy to call the controller
    await execute('StakingRewardsController', { from: deployer }, 'setTrustedRemote', CHAIN_ID_TESTNET['AVAX'], proxyAddress);
};

module.exports.tags = ['StakingPermissionsFantom'];
