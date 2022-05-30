import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";
import "hardhat-deploy";
import dotenv from "dotenv";

// tasks

import accounts from "./tasks/accounts";

dotenv.config();

const tasks = () => {
  accounts();
};

tasks();

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const TESTNET_KEY = process.env.TESTNET_KEY;
const MNEMONIC = process.env.MNEMONIC || "sample-mnemonic";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "etherscan-api-key";

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    hardhat: {},
    fantomtestnet: {
      url: "https://rpc.testnet.fantom.network",
      "chainId": 4002,
      gasPrice: 50000000000,
      accounts: [TESTNET_KEY]
    },
    mumbai: {
      url: "https://matic-mumbai.chainstacklabs.com",
      chainId: 80001,
      gasPrice: 20000000000,
      accounts: [TESTNET_KEY]
    },
    bsctestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [TESTNET_KEY]
    },
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      gasPrice: 26000000000,
      accounts: [TESTNET_KEY]
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/",
      chainId: 4,
      gasPrice: 20000000000,
      accounts: [TESTNET_KEY]
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 100000,
  },
};
