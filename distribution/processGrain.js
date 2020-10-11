const sc = require('sourcecred').default;
const fs = require('fs-extra');
const _ = require('lodash');
const fetch = require('node-fetch');
const Ledger = sc.ledger.ledger.Ledger;
const G = sc.ledger.grain;

const BigNumber = require('bignumber.js');
const transaction = require('./dao.json');

const NodeAddress = sc.core.address.makeAddressModule({
	name: 'NodeAddress',
	nonce: 'N',
	otherNonces: new Map().set('E', 'EdgeAddress'),
});

const LEDGER_PATH = 'data/ledger.json';
const address_book_file = 'https://raw.githubusercontent.com/ShenaniganDApp/scoreboard/master/data/addressbook.json';
const newMintAmounts = [];

async function processGrain() {
	const ledgerJSON = (await fs.readFile(LEDGER_PATH)).toString();
	const accountsJSON = JSON.parse((await fs.readFile('output/accounts.json')).toString());

	const oldAccounts = JSON.parse(await (await fs.readFile('distribution/oldAccounts.json')).toString());
	const oldAccountsMap = _.keyBy(oldAccounts, 'discordId');

	const AddressBook = await (await fetch(address_book_file)).json();

	const AddressMap = _.keyBy(AddressBook, 'discordId');

	const accountMap = _.keyBy(accountsJSON.accounts, 'account.identity.id');



	const ledger = Ledger.parse(ledgerJSON);
	let accounts = ledger.accounts();

	// await activateAccounts();

	const activeAccounts = accountsJSON.accounts.filter((acc) => acc.account.active);
	const activeUserMap = _.keyBy(activeAccounts, 'account.identity.id');

	try {
		const discordAcc = accounts
			.map((a) => {
				const credAcc = activeUserMap[a.identity.id];
				if (!credAcc) return null;
				if (a.identity.subtype !== 'USER') return null;
				const discordAliases = a.identity.aliases.filter((alias) => {
					const parts = NodeAddress.toParts(alias.address);
					return parts.indexOf('discord') > 0;
				});

				if (!discordAliases.length) return null;

				let user = null;
				let discordId = null;

				discordAliases.forEach((alias) => {
					discordId = NodeAddress.toParts(alias.address)[4];
					if (oldAccountsMap[discordId]) {
						user = oldAccountsMap[discordId];
					}
					if (AddressMap[discordId]) {
						user = AddressMap[discordId];
						
					}
				});
				
				console.log('user: ', user);
				return {
					...a,
					discordId,
					cred: credAcc.totalCred,
					ethAddress: user && user.address,
				};
			})
			.filter(Boolean);

		const discordAccWithAddress = discordAcc.filter((a) => a.ethAddress);

		// // Commented out since transfer was already completed in ledger
		// deductSeedsAlreadyMinted(discordAccWithAddress, ledger);

		await fs.writeFile(LEDGER_PATH, ledger.serialize());

		discordAccWithAddress.forEach((acc) => {
			const amountToMint = G.format(acc.balance, 18, '').replace('.', '').replace(',', '');
			newMintAmounts.push([acc.ethAddress, amountToMint]);
		});

		console.log(newMintAmounts.map((e) => e.join(',')).join('\n'));
	} catch (err) {
		console.log(err);
	}
}
async function activateAccounts() {
	try {
		accounts.map((a) => {
			const credAcc = accountMap[a.identity.id];
			if (!credAcc) return null;
			if (a.identity.subtype !== 'USER') return null;
			const discordAliases = a.identity.aliases.filter((alias) => {
				const parts = NodeAddress.toParts(alias.address);
				return parts.indexOf('discord') > 0;
			});
			discordAliases.forEach((alias) => {
				discordId = NodeAddress.toParts(alias.address)[4];
				if (AddressMap[discordId]) {
					ledger.activate(a.identity.id);
					console.log('a.identity.id: ', a.identity.id);
				}
			});
		});
		await fs.writeFile(LEDGER_PATH, ledger.serialize());
	} catch (err) {
		console.log('err: ', err);
	}
}

function mintSettings(tx) {
	const settings = tx;

	const splits = _.chunk(newMintAmounts, 50);
	settings[0].mints = splits[0];
	console.log(settings[0].mints.length);

	return JSON.stringify(settings, null, 2);
}

/**
 * Entry point to the `processGrain.js` script
 * @returns <Promise>
 */
const rewards = () => {
	try {
		fs.writeFile('./distribution/transactionSettings.json', mintSettings(transaction), (err) => {
			if (err) {
				console.log('Did not save transaction settings');
				console.log(err);
			}
		});
		return 'file sucessfully written';
	} catch (err) {
		console.error(err);
		process.exit(-1);
	}
};
processGrain().then(() => {
	console.log(mintSettings(transaction));
	console.log(rewards());
});
