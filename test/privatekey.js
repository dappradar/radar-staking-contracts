const { ethers } = require('hardhat')

module.exports = index => {
    const mnemonic = 'test test test test test test test test test test test junk';
    return ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`).privateKey;
}
