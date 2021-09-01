const sc = require('sourcecred').sourcecred;
const _ = require('lodash');

const fs = require('fs');
const util = require('util');
const BigNumber = require('bignumber.js');
const fetch = require('node-fetch');
const queries = require('./queries');
const snapshot = require('erc20-snapshot');
const { forEach } = require('lodash');
const readFile = util.promisify(fs.readFile);
const EPOCHS_PATH = './lastRewardEpoch.json';
const Ledger = sc.ledger.ledger.Ledger;
//17814800
const ethers = require('ethers');

const ADDRESS_BOOK_PATH = '../data/addressbook.json';
const LEDGER_PATH = '../data/ledger.json';

const NodeAddress = sc.core.address.makeAddressModule({
  name: 'NodeAddress',
  nonce: 'N',
  otherNonces: new Map().set('E', 'EdgeAddress'),
});

const rewardsPairs = [
  '0xa527dbc7cdb07dd5fdc2d837c7a2054e6d66daf4',
  '0xaaefc56e97624b57ce98374eb4a45b6fd5ffb982',
  '0x37251b86f97813f6cfda3d2074b0929dbf7b7854',
];
const oneWeekInBlocks = 120992;
const oneDayInBlocks = 17284;

const provider = new ethers.providers.JsonRpcProvider(
  'https://rpc.xdaichain.com/'
);
const getTimeData = async (blockNumber) => {
  const startUnixTimestamp =
    (await (await provider.getBlock(blockNumber)).timestamp) * 1000;
  const endUnixTimestamp =
    (await (await provider.getBlock(blockNumber + oneWeekInBlocks)).timestamp) *
    1000;
  return { startUnixTimestamp, endUnixTimestamp };
};

(async () => {
  const epochData = await JSON.parse((await readFile(EPOCHS_PATH)).toString());
  const ledgerJSON = (await readFile(LEDGER_PATH)).toString();
  const addressbook = await JSON.parse(
    (await readFile(ADDRESS_BOOK_PATH)).toString()
  );
  const addressBookMap = _.keyBy(addressbook, 'address');
  const AddressMap = _.keyBy(addressbook, 'discordId');

  const accountsJSON = JSON.parse(
    (await readFile('../output/accounts.json')).toString()
  );

  const UserMap = _.keyBy(accountsJSON.accounts, 'account.identity.id');

  const ledger = Ledger.parse(ledgerJSON);
  let accounts = ledger.accounts();

  let weightedRewardsPerEpoch = [];
  let timeDataByAddresses = {};
  let timeWeightPeriods = [];
  let weekCount = 0;
  for (
    let k = epochData.startBlock;
    k < epochData.endBlock;
    k += oneWeekInBlocks
  ) {
    let dayCount = 0;
    let reserveUSDJSON = [];

    // reserve for each token
    let reserveUSDSums = [];
    let liquidityTotals = [];
    let liquidityWeights = [];
    let blockWeekCounter = epochData.startBlock + oneWeekInBlocks * weekCount;
    for (
      let i = blockWeekCounter;
      i < oneWeekInBlocks + blockWeekCounter;
      i += oneDayInBlocks
    ) {
      for (let j = 0; j < rewardsPairs.length; j++) {
        let {
          data: { pair: reserveUSD },
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
                query: queries.usdReserveAtBlock(rewardsPairs[j], i),
              }),
            }
          )
        ).json();

        reserveUSD =
          reserveUSD && reserveUSD.reserveUSD
            ? new BigNumber(reserveUSD.reserveUSD)
            : new BigNumber(0);

        reserveUSDJSON[dayCount] = {
          [rewardsPairs[j]]: reserveUSD,
          ...reserveUSDJSON[dayCount],
        };

        if (reserveUSDSums[dayCount]) {
          reserveUSDSums[dayCount] = reserveUSD.plus(reserveUSDSums[dayCount]);
        } else {
          reserveUSDSums.push(reserveUSD);
        }
      }
      rewardsPairs.forEach((address) => {
        liquidityWeights[dayCount] = {
          [address]: reserveUSDJSON[dayCount][address]
            .dividedBy(reserveUSDSums[dayCount])
            .toString(),
          ...liquidityWeights[dayCount],
        };
      }),
        console.log(
          `Calculating rewards for blocks ${i} to ${i + oneDayInBlocks}`
        );
      const balances = await snapshot.takeSnapshot(i);

      rewardsPairs.forEach((address) => {
        if (balances[address]) {
          const total = balances[address].reduce((acc, { balance }) => {
            return acc.plus(new BigNumber(balance));
          }, new BigNumber(0));
          liquidityTotals[dayCount] = {
            [address]: total.toString(),
            ...liquidityTotals[dayCount],
          };
        }
      });
      weightedReward = {};

      // Filter for wallets in the addressbook
      // multiply each token balance by the reserveUSD of the pool
      // then divide it by the total amount of tokens
      rewardsPairs.forEach((address) => {
        if (balances[address]) {
          weightedReward[address] = balances[address]
            .filter(({ wallet }) => {
              return addressbook.find(
                ({ address: userAddress }) => userAddress === wallet
              );
            })
            .map(({ wallet, balance }) => {
              return {
                wallet,
                blockNumber: i + oneDayInBlocks,
                balance: new BigNumber(balance)
                  .multipliedBy(
                    new BigNumber(reserveUSDJSON[dayCount][address])
                  )
                  .dividedBy(new BigNumber(liquidityTotals[dayCount][address])),
              };
            });
        }
      });

      weightedRewardsPerEpoch.push({ epochBlock: i, ...weightedReward });
      dayCount++;
    }

    weekCount++;
  }

  // calculate the time periods for time weighting per wallet
  for (let i = 0; i < weightedRewardsPerEpoch.length; i++) {
    rewardsPairs.forEach((address) => {
      const dayRewards = weightedRewardsPerEpoch[i][address];
      if (dayRewards) {
        for (let j = 0; j < dayRewards.length; j++) {
          const { wallet, blockNumber, balance } = dayRewards[j];
          if (
            wallet in timeDataByAddresses &&
            address in timeDataByAddresses[wallet]
          ) {
            const {
              startBlockNumber,
              endBlockNumber,
              previousBalance,
              weight,
            } = timeDataByAddresses[wallet][address];
            if (!timeWeightPeriods[wallet]) timeWeightPeriods[wallet] = [];

            // when balance is 0 rewards timer starts over for future rewards
            if (i === weightedRewardsPerEpoch.length - 1) {
              timeWeightPeriods = [
                {
                  wallet,
                  startBlockNumber,
                  endBlockNumber,
                  weight,
                  tokenAddress: address,
                },
                ...timeWeightPeriods,
              ];
            } else if (balance.eq(0) && !previousBalance.eq(0)) {
              timeWeightPeriods = [
                {
                  wallet,
                  startBlockNumber,
                  endBlockNumber,
                  weight,
                  tokenAddress: address,
                },
                ...timeWeightPeriods,
              ];

              timeDataByAddresses[wallet][address] = {
                startBlockNumber: blockNumber,
                endBlockNumber: blockNumber,
                previousBalance,
                weight: 1,
                ...timeDataByAddresses[wallet][address],
              };
            } else if (balance < previousBalance) {
              timeWeightPeriods = [
                {
                  wallet,
                  startBlockNumber,
                  endBlockNumber,
                  weight,
                  tokenAddress: address,
                },
                ...timeWeightPeriods,
              ];
              // when balance is less than previous epoch, rewards are calculated at current weight, then continue
              timeDataByAddresses[wallet][address] = {
                startBlockNumber: blockNumber,
                endBlockNumber: blockNumber,
                previousBalance,
                ...timeDataByAddresses[wallet][address],
              };
            } else {
              // If balance is greater than or equal to the previous epoch, continue
              const daysStaked = (endBlockNumber - startBlockNumber) / 17284;
              const monthsStaked = daysStaked / 30;
              let weight = 0;
              if (monthsStaked >= 1 && monthsStaked < 2) {
                weight = 2;
              } else if (monthsStaked >= 2) {
                weight = 3;
              } else {
                weight = 1;
              }
              timeDataByAddresses[wallet][address] = {
                startBlockNumber,
                endBlockNumber: blockNumber,
                previousBalance: balance,
                weight,
              };
            }
          } else {
            if (wallet in timeDataByAddresses) {
              timeDataByAddresses[wallet][address] = {
                startBlockNumber: blockNumber,
                endBlockNumber: blockNumber,
                previousBalance: new BigNumber(0),
                weight: 1,
              };
            } else {
              timeDataByAddresses[wallet] = {};
              timeDataByAddresses[wallet][address] = {
                startBlockNumber: blockNumber,
                endBlockNumber: blockNumber,
                previousBalance: new BigNumber(0),
                weight: 1,
              };
            }
          }
        }
      }
    });
  }
  // Multiply rewards by weight
  timeWeightPeriods.forEach((period) => {
    const { wallet, startBlockNumber, endBlockNumber, weight, tokenAddress } =
      period;
    weightedRewardsPerEpoch.forEach((epoch) => {
      const { epochBlock } = epoch;
      if (
        weight > 1 &&
        epochBlock >= startBlockNumber &&
        epochBlock < endBlockNumber
      ) {
        // This is a O(n)^2 problem since we search all addresses for every epoch
        // it would be better to restructure so we can do a single search for
        // every address in a given time period and update its value
        epoch[tokenAddress].map((position) =>
          position.wallet === wallet
            ? { ...position, balance: position.balance.multipliedBy(weight) }
            : position
        );
      }
    });
  });

  // Calculate weekly maximums and normalize

  for (
    let k = epochData.startBlock;
    k < epochData.endBlock;
    k += oneWeekInBlocks
  ) {
    let weekTotalRewards = {};
    let weekSum = new BigNumber(0);
    weightedRewardsPerEpoch.forEach((epoch) => {
      const epochBlock = epoch.epochBlock;
      if (epochBlock >= k && epochBlock < k + oneWeekInBlocks) {
        rewardsPairs.forEach((address) => {
          if (epoch[address]) {
            epoch[address].forEach((position) => {
              const { wallet, balance } = position;
              if (weekTotalRewards[wallet] !== undefined) {
                const previousMax = weekTotalRewards[wallet];
                weekTotalRewards[wallet] = previousMax.plus(balance);
                weekSum = weekSum.plus(balance);
              } else {
                weekTotalRewards[wallet] = balance;
                weekSum = weekSum.plus(balance);
              }
            });
          }
        });
      }
    });
    Object.keys(weekTotalRewards).forEach((wallet) => {
      weekTotalRewards[wallet] = weekTotalRewards[wallet]
        .dividedBy(weekSum)
        .multipliedBy(13)
        .toString();
    });

    //Write this weeks scores into an initiative

    const accountCred = Object.keys(weekTotalRewards).map((wallet) => {
      const discordId = addressBookMap[wallet].discordId;
      const cred = weekTotalRewards[wallet];
      return { discordId, cred };
    });

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

    // Get block timestamp
    const { startUnixTimestamp, endUnixTimestamp } = await getTimeData(k);

    const startDateISO = new Date(startUnixTimestamp).toISOString();

    const endDateISO = new Date(endUnixTimestamp).toISOString();

    const startDateLocale = new Date(startUnixTimestamp).toLocaleString();
    const endDateLocale = new Date(endUnixTimestamp).toLocaleString();

    const endDateYear = startDateISO.split('T')[0].split('-')[0];
    const endDateMonth = startDateISO.split('T')[0].split('-')[1];

    const entries = discordAcc.map((a) => {
      return `
        {
          "title": "Liquidity Provider: @${a.identity.name}",
          "timestampIso": "${endDateISO}",
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
        "title": "Liquidity Rewards Week of ${startDateLocale} to ${endDateLocale} ",
        "timestampIso": "${endDateISO}",
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
      `../config/plugins/sourcecred/initiatives/initiatives/${endDateYear}-${endDateMonth}-liquidity-rewards-${
        endDateISO.split('T')[0]
      }`,
      fileJson
    );
  }
})();
