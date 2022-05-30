const { BigNumber } = require('ethers')

const token = BigNumber.from(10).pow(18) // a token is 18 decimals

module.exports = async ({ getNamedAccounts, deployments }) => {

  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  let tokenContract = await deploy('RadarToken', {
    from: deployer,
    args: [
      'Test', // name
      'TEST', // symbol
      [
        '0xe2e1F875c8Db3a663576d4093564cE89c800f378', // drk
      ], // mint addresses
      [
        token.mul(BigNumber.from(10).pow(9).mul(8)) // 8b for drk
      ] // mint amounts
    ],
    log: true,
  });

  console.log('Token address:' + tokenContract.address);
};

module.exports.tags = ['RadarToken'];
