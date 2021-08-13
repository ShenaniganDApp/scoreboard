const _ = require('lodash');

const fs = require('fs');
const util = require('util');
const BigNumber = require('bignumber.js');
const fetch = require('node-fetch');
const queries = require('./queries');
const snapshot = require('erc20-snapshot');
const readFile = util.promisify(fs.readFile);
const EPOCHS_PATH = './lastRewardEpoch.json';
const ADDRESS_BOOK_PATH = '../data/addressbook.json';
const rewardsPairs = [
  '0xa527dbc7cdb07dd5fdc2d837c7a2054e6d66daf4',
  '0xaaefc56e97624b57ce98374eb4a45b6fd5ffb982',
];
const oneWeekInBlocks = 120992;
const oneDayInBlocks = 17284;
(async () => {
  const data = await JSON.parse((await readFile(EPOCHS_PATH)).toString());
  const addressbook = await JSON.parse(
    (await readFile(ADDRESS_BOOK_PATH)).toString()
  );
  let dailyWeightedRewards = [];
  let weekCount = 0;
  for (let k = data.startBlock; k < data.endBlock; k += oneWeekInBlocks) {
    let dayCount = 0;
    let reserveUSDJSON = [];
    let reserveUSDSums = [];
    let liquidityTotals = [];
    let liquidityWeights = [];
    let blockWeekCounter = data.startBlock + oneWeekInBlocks * weekCount;
    console.log('blockWeekCounter: ', blockWeekCounter);
    for (
      let i = blockWeekCounter;
      i < oneWeekInBlocks + blockWeekCounter;
      i += oneDayInBlocks
    ) {
      rewardsPairs.map(async (address) => {
        const {
          data: {
            pair: { reserveUSD },
          },
        } = await (
          await fetch(
            'https://api.thegraph.com/subgraphs/name/1hive/uniswap-v2',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                query: queries.usdReserveAtBlock(address, i),
              }),
            }
          )
        ).json();
        reserveUSDJSON[dayCount] = {
          [address]: reserveUSD,
          ...reserveUSDJSON[dayCount],
        };
        reserveUSDSums[dayCount] += reserveUSD;
      });
      rewardsPairs.forEach((address) => {
        liquidityWeights[dayCount] = {
          [address]: reserveUSDJSON[address] / reserveUSDSums[dayCount],
          ...liquidityWeights[dayCount],
        };
      }),
        console.log(
          `Calculating rewards for blocks ${i} to ${i + oneDayInBlocks}`
        );
      const balances = await snapshot.takeSnapshot(i);

      rewardsPairs.map((address) => {
        const total = balances[address].reduce((acc, { balance }) => {
          return acc.plus(new BigNumber(balance));
        }, new BigNumber(0));
        liquidityTotals[dayCount] = {
          [address]: total,
          ...liquidityTotals[dayCount],
        };
      });
      if (!dailyWeightedRewards[weekCount])
        dailyWeightedRewards[weekCount] = [];
      weightedDayRewards = {};
      rewardsPairs.forEach((address) => {
        weightedDayRewards[address] = balances[address].map(
          ({ wallet, balance }) => {
            //filter addressbook accounts. THIS IS SLOW
            addressbook.forEach(({ address }) => {
              if (address === wallet)
                return {
                  wallet,
                  balance: new BigNumber(balance)
                    .multipliedBy(
                      new BigNumber(reserveUSDJSON[dayCount][address])
                    )
                    .dividedBy(
                      new BigNumber(liquidityTotals[dayCount][address])
                    ),
                };
            });
          }
        );
      });
      dailyWeightedRewards[weekCount].push(weightedDayRewards);
      dayCount++;
    }

    weekCount++;
  }
})();

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
