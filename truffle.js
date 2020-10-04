const homedir = require('homedir');
const path = require('path');

const HDWalletProvider = require('truffle-hdwallet-provider');
const HDWalletProviderPrivkey = require('truffle-hdwallet-provider-privkey');

const DEFAULT_MNEMONIC = 'stumble story behind hurt patient ball whisper art swift tongue ice alien';

const defaultRPC = (network) => `https://${network}.infura.io`;

const configFilePath = (filename) => path.join(homedir(), `.aragon/${filename}`);

const mnemonic = () => {
	try {
		return require(configFilePath('mnemonic.json')).mnemonic;
	} catch (e) {
		return DEFAULT_MNEMONIC;
	}
};

const settingsForNetwork = (network) => {
	try {
		return require(configFilePath(`${network}_key.json`));
	} catch (e) {
		return {};
	}
};

// Lazily loaded provider
const providerForNetwork = (network) => () => {
	let { rpc, keys } = settingsForNetwork(network);

	rpc = rpc || defaultRPC(network);

	if (!keys || keys.length == 0) {
		return new HDWalletProvider(mnemonic(), rpc);
	}

	return new HDWalletProviderPrivkey(keys, rpc);
};

// const mocha = process.env.GAS_REPORTER ? mochaGasSettings : {}

module.exports = {
	networks: {
		xdai: {
			network_id: 100,
			provider: providerForNetwork('xdai'),
			gas: 7.9e6,
			gasPrice: 1000000000,
		},
	},
	build: {},
	compilers: {
		solc: {
			version: '0.4.24',
			settings: {
				optimizer: {
					enabled: true,
					runs: 1,
				},
			},
		},
	},
};
