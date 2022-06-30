module.exports = async ({ getNamedAccounts, deployments }) => {
    const {deploy, get} = deployments;
    const {deployer} = await getNamedAccounts();

    let controller = await deploy('StakingRewardsController', {
        from: deployer,
        args: [
            '0xBd7ECEdDa1a2a869CB74683a878B17987eEa60b5', // owner: drk
            "3858024691358030000", // token rewards per second
            '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7', // fantom endpoint
        ],
        log: true,
    });

    console.log('Controller address: ' + controller.address);
};

module.exports.tags = ['StakingRewardsController'];
