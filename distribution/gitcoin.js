const sc = require('sourcecred').default;
const fs = require('fs-extra');
const _ = require('lodash');
const fetch = require('node-fetch');
const Ledger = sc.ledger.ledger.Ledger;
const G = sc.ledger.grain;

const NodeAddress = sc.core.address.makeAddressModule({
	name: 'NodeAddress',
	nonce: 'N',
	otherNonces: new Map().set('E', 'EdgeAddress'),
});

const LEDGER_PATH = 'data/ledger.json';
const DEPENDENCIES_PATH = 'config/dependencies.json';
const address_book_file = 'https://raw.githubusercontent.com/ShenaniganDApp/scoreboard/master/data/addressbook.json';
const newMintAmounts = [];
function processData(allText) {
	var allTextLines = allText.split(/\r\n|\n/);
	var headers = allTextLines[0].split(',');
	var lines = [];

	for (var i = 1; i < allTextLines.length; i++) {
		var data = allTextLines[i].split(',');
		if (data.length == headers.length) {
			var tarr = [];
			for (var j = 0; j < headers.length; j++) {
				tarr.push(data[j]);
			}
			lines.push(tarr);
		}
	}
	return lines;
}

(async () => {
	const ledgerJSON = (await fs.readFile(LEDGER_PATH)).toString();

	const accountsJSON = JSON.parse((await fs.readFile('output/accounts.json')).toString());

	const accountMap = _.keyBy(accountsJSON.accounts, 'account.identity.id');
	const AddressBook = await (await fetch(address_book_file)).json();

	const AddressMap = _.keyBy(AddressBook, 'discordId');

	const UserMap = _.keyBy(accountsJSON.accounts, 'account.identity.id');

	const ledger = Ledger.parse(ledgerJSON);
	let accounts = ledger.accounts();

	const fileData = fs.readFileSync('./distribution/finance.csv', { encoding: 'utf8' });
	const addressbookData = JSON.parse(fs.readFileSync('./data/addressbook.json', { encoding: 'utf8' }));
	const addressBookMap = _.keyBy(addressbookData, 'address');

	const lines = processData(fileData);
	const accountAmount = lines.map((line) => {
		const formatLine = line[2].replace(/\"/g, '');
		const amount = +line[4].replace(/[^\d.-]/g, '');
		return [formatLine, amount];
	});

	try {
		let total = 0;
		accountAmount.map((a) => {
			if (a[0] in addressBookMap) {
				total += a[1];
			}
		});
		const accountCred = accountAmount
			.filter((f) => f[0] in addressBookMap)
			.map((a) => {
				const discordId = addressBookMap[a[0]].discordId;
				const cred = (a[1] / total) * 21;
				return { discordId, cred };
			});

		for (let i = 0; i < accountCred.length; i++) {
			for (let j = i + 1; j < accountCred.length; j++) {
				if (accountCred[i].discordId === accountCred[j].discordId) {
					accountCred[i].cred += accountCred[j].cred;
					accountCred.splice(j, 1);
				}
			}
		}
		const accountCredMap = _.keyBy(accountCred, 'discordId');
		const discordAcc = accounts

			.map((a) => {
				const credAcc = UserMap[a.identity.id];
				if (!credAcc) return null;
				if (a.identity.subtype !== 'USER') return null;
				const discordAliases = a.identity.aliases.filter((alias) => {
					const parts = NodeAddress.toParts(alias.address);
					return parts.indexOf('discord') > 0;
				});
				let amount = null;
				let discordId = null;
				discordAliases.forEach((alias) => {
					discordId = NodeAddress.toParts(alias.address)[4];
					if (AddressMap[discordId]) {
						if (accountCredMap[discordId]) {
							amount = accountCredMap[discordId].cred;
						}
					}
				});

				return amount
					? {
							...a,
							amount,
					  }
					: null;
			})
			.filter(Boolean);
			console.log(discordAcc);
		const entries = discordAcc.map((a) => {
			return `
			{
				"title": "Donation @${a.identity.name}",
				"timestampIso": "2021-01-15T10:00:00.000Z",
				"weight": ${a.amount},
				"contributors": ["@${a.identity.name}"]
			}`;
		});

		const fileJson = `[
		{
			"type": "sourcecred/initiativeFile",
			"version": "0.2.0"
		},
		{
			"title": "Gitcoin Hack",
			"timestampIso": "2021-02-07T10:00:00.000Z",
			"weight": {
				"incomplete": 0,
				"complete": 0
			},
			"completed": true,
			"champions": [],
			"dependencies": {},
			"references": {},
			"contributions":{ 
				"entries": [${entries}]
		}
	}]`;
		fs.writeFileSync(
			'./config/plugins/sourcecred/initiatives/initiatives/2021-02-patron-gem-hack.json',
			fileJson
		);
	} catch (err) {
		console.log(err);
	}
})();
