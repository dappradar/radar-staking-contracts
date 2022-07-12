const {utils, Wallet} = require('ethers')
const {ecsign} = require('ethereumjs-util')

const {keccak256, solidityPack, formatBytes32String, arrayify} = utils

let ethersProvider = new ethers.providers.WebSocketProvider('wss://ancient-green-moon.bsc.quiknode.pro/79658da83e9ff448322773213d9256c0f8ea8073/');

module.exports = async (
    privateKey,
    data
) => {
    const signer = new Wallet(privateKey, ethersProvider);

    const domain = {
        name: 'RADAR Cross-Chain Staking',
        version: '1',
    };

// The named list of all type definitions
    const types = {
        ActionData: [
            { name: 'action', type: 'bytes32' },
            { name: 'amount', type: 'uint256' }
        ],
    };

    const {action, amount} = data;

    const value = {
        action: formatBytes32String(action),
        amount: amount
    };

    return await signer._signTypedData(domain, types, value);
}
