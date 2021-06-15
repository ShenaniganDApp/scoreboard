const _ = require('lodash');

const fs = require('fs');
const BigNumber = require('bignumber.js');
const fetch = require('node-fetch');
const queries = require('./queries');

let hnyMints = {};
let hnyBurns = {};
let xdaiMints = {};
let xdaiBurns = {};

(async () => {
	const fetchMintsandBurns = () => {
		const output = fetch('https://api.thegraph.com/subgraphs/name/1hive/uniswap-v2', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({ query: queries.mints('0xa527dbc7cdb07dd5fdc2d837c7a2054e6d66daf4') }),
		})
			.then((r) => r.json())
			.then(({ data: { mints } }) => {
				const txHashes = [];
				const promises = [];
				for (let i = 0; i < mints.length; i++) {
					txHashes.push(mints[i].transaction.id);
				}
				const chunkedHashes = _.chunk(txHashes, 100);                
				fetch(`https://blockscout.com/poa/xdai/graphiql`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: JSON.stringify({ query: queries.txSender(chunkedHashes) }),
				})
					.then((r) => {
						r.json();
					})
					.then((data) => {
						console.log('data: ', data);
					});
			});
	};
	fetchMintsandBurns();

	// var totalMintsPerAddress = _(hnyMintMap)
	// 	.map((objs, key) => {
	// 		return {
	// 			address: key,
	// 			amountUSD: _.sumBy(objs, function (o) {
	// 				return Number(o.amountUSD);
	// 			}),
	// 		};
	// 	})
	// 	.value();

	// console.log(totalMintsPerAddress);
})();
