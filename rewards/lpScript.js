const _ = require('lodash');

const fs = require('fs');
const BigNumber = require('bignumber.js');
const fetch = require('node-fetch');
const queries = require('./queries');
const { fromPairs } = require('lodash');
const snapshot = require('erc20-snapshot');

let hnyMintsAndBurns;
let xdaiMintsAndBurns;
let hausMintsAndBurns;

snapshot.takeSnapshot()

// const fetchMintsandBurns = async (address) => {
//   console.log('Fetching Mints and Burns...');
//   const {
//     data: { mints },
//   } = await (
//     await fetch('https://api.thegraph.com/subgraphs/name/1hive/uniswap-v2', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Accept: 'application/json',
//       },
//       body: JSON.stringify({ query: queries.mints(address) }),
//     })
//   ).json();
//   const {
//     data: { burns },
//   } = await (
//     await fetch('https://api.thegraph.com/subgraphs/name/1hive/uniswap-v2', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Accept: 'application/json',
//       },
//       body: JSON.stringify({ query: queries.burns(address) }),
//     })
//   ).json();
//   const mintHashes = [];
//   const burnHashes = [];
//   for (let i = 0; i < mints.length; i++) {
//     mintHashes.push(mints[i].transaction.id);
//   }
//   for (let i = 0; i < burns.length; i++) {
//     burnHashes.push(burns[i].transaction.id);
//   }
//   const chunkedMintHashes = _.chunk(mintHashes, 50);
//   const chunkedBurnHashes = _.chunk(burnHashes, 50);

//   const finalMints = [];
//   const finalBurns = [];
//   for (let i = 0; i < chunkedMintHashes.length; i++) {
//     const { data } = await (
//       await fetch(`https://blockscout.com/poa/xdai/graphiql`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Accept: 'application/json',
//         },
//         body: JSON.stringify({ query: queries.txSender(chunkedMintHashes[i]) }),
//       })
//     ).json();
//     const txDataArray = Object.keys(data).reduce((acc, curr) => {
//       return [...acc, { ...data[curr] }];
//     }, []);
//     txDataArray.forEach((tx) => {
//       mints.forEach((mint) => {
//         if (mint.transaction.id === tx.hash) {
//           finalMints.push({ fromAddressHash: tx.fromAddressHash, ...mint });
//         }
//       });
//     });
//   }
//   for (let i = 0; i < chunkedBurnHashes.length; i++) {
//     const { data } = await (
//       await fetch(`https://blockscout.com/poa/xdai/graphiql`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Accept: 'application/json',
//         },
//         body: JSON.stringify({ query: queries.txSender(chunkedBurnHashes[i]) }),
//       })
//     ).json();
//     const txDataArray = Object.keys(data).reduce((acc, curr) => {
//       return [...acc, { ...data[curr] }];
//     }, []);
//     txDataArray.forEach((tx) => {
//       burns.forEach((burn) => {
//         if (burn.transaction.id === tx.hash) {
//           finalBurns.push({ fromAddressHash: tx.fromAddressHash, ...burn });
//         }
//       });
//     });
//   }
//   return { mints: finalMints, burns: finalBurns };
// };

// const getAccountTotalsBeforeTimestamp = (totalMints, totalBurns, timestamp) => {
//   const totalAccountMint = Object.keys(totalMints).forEach((account) => {
//     totalMints[account]
//       .filter((mint) => {
//         return mint.timestamp < timestamp;
//       })
//       .reduce(
//         (acc, mint) => {
//           console.log('acc: ', acc);
//           if (mint.liquidity)
//             return acc.liquidity.plus(new BigNumber(mint.liquidity));
//         },
//         { liquidity: new BigNumber(0) }
//       );
//   });
//   const totalAccountBurn = Object.keys(totalBurns).forEach((account) => {
//     totalBurns[account]
//       .filter((burn) => {
//         return burn.timestamp < timestamp;
//       })
//       .reduce(
//         (acc, burn) => {
//           if (burn.liquidity)
//             return burn.acc.liquidity.plus(new BigNumber(burn.liquidity));
//         },
//         { liquidity: new BigNumber(0) }
//       );
//   });

//   return { totalAccountMint, totalAccountBurn };
// };

// // const getTotalLiquidityAtTimestamp = (timestamp) => {
// //   if (!xdaiMintsAndBurns || !hnyMintsAndBurns) return;
// //   const totalMints = _.reduce(
// //     xdaiMintsAndBurns.mints,
// //     (acc, mint) => {
// //       if (mint.timestamp < timestamp) {
// //         acc[mint.fromAddressHash] = acc[mint.fromAddressHash] || 0;
// //         acc[mint.fromAddressHash] += mint.value;
// //       }
// //       return acc;
// //     },
// //     {}
// //   );
// //   const totalBurns = _.reduce(
// //     burns,
// //     (acc, burn) => {
// //       if (burn.timestamp < timestamp) {
// //         acc[burn.fromAddressHash] = acc[burn.fromAddressHash] || 0;
// //         acc[burn.fromAddressHash] -= burn.value;
// //       }
// //       return acc;
// //     },
// //     {}
// //   );
// //   return { mints, burns, totalMints, totalBurns };
// // };

// (async () => {
//   const startTimestamp = 1614585600;
//   const endTimestamp = startTimestamp + 604800;
//   hnyMintsAndBurns = await fetchMintsandBurns(
//     '0xaaefc56e97624b57ce98374eb4a45b6fd5ffb982'
//   );
//   xdaiMintsAndBurns = await fetchMintsandBurns(
//     '0xa527dbc7cdb07dd5fdc2d837c7a2054e6d66daf4'
//   );
//   const accountMintsAndBurnsHNY = {
//     mints: _.groupBy(hnyMintsAndBurns.mints, 'fromAddressHash'),
//     burns: _.groupBy(hnyMintsAndBurns.burns, 'fromAddressHash'),
//   };
//   const accountMintsAndBurnsXDAI = {
//     mints: _.groupBy(xdaiMintsAndBurns.mints, 'fromAddressHash'),
//     burns: _.groupBy(xdaiMintsAndBurns.burns, 'fromAddressHash'),
//   };

//   const hnyLiquidityTotals = getAccountTotalsBeforeTimestamp(
//     accountMintsAndBurnsHNY.mints,
//     accountMintsAndBurnsHNY.burns,
//     startTimestamp
//   );
//   console.log('hnyLiquidityTotals: ', hnyLiquidityTotals);
//   const xdaiLiquidityTotals = getAccountTotalsBeforeTimestamp(
//     accountMintsAndBurnsXDAI.mints,
//     accountMintsAndBurnXDAI.burns,
//     startTimestamp
//   );

//   console.log('accountsMintsBeforeTimestamp: ', accountsMintsBeforeTimestamp);
// })();
