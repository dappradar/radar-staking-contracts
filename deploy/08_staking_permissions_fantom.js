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

    const bscProxyAddress = '0xB833F2188AB9B0cc07831B6F34176acC51954bEb';
    const ethProxyAddress = '0xD1f28371B32c64975A7bFad9592d36d5a8DB1FC1';

    // allow bsc & eth proxies to call the controller
    await execute('StakingRewardsController', { from: deployer }, 'setTrustedRemote', CHAIN_ID_MAINNET['BSC'], bscProxyAddress);
    await execute('StakingRewardsController', { from: deployer }, 'setTrustedRemote', CHAIN_ID_MAINNET['ETH'], ethProxyAddress);
};

module.exports.tags = ['StakingPermissionsFantom'];
