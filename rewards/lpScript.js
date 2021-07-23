const _ = require('lodash');

const fs = require('fs');
const BigNumber = require('bignumber.js');
const fetch = require('node-fetch');
const queries = require('./queries');
const { fromPairs } = require('lodash');

const fetchMintsandBurns = async (address) => {
  console.log('Fetching Mints and Burns...');
  const {
    data: { mints },
  } = await (
    await fetch('https://api.thegraph.com/subgraphs/name/1hive/uniswap-v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query: queries.mints(address) }),
    })
  ).json();
  const {
    data: { burns },
  } = await (
    await fetch('https://api.thegraph.com/subgraphs/name/1hive/uniswap-v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query: queries.burns(address) }),
    })
  ).json();
  const mintHashes = [];
  const burnHashes = [];
  for (let i = 0; i < mints.length; i++) {
    mintHashes.push(mints[i].transaction.id);
  }
  for (let i = 0; i < burns.length; i++) {
    burnHashes.push(burns[i].transaction.id);
  }
  const chunkedMintHashes = _.chunk(mintHashes, 50);
  const chunkedBurnHashes = _.chunk(burnHashes, 50);

  const finalMints = [];
  const finalBurns = [];
  for (let i = 0; i < chunkedMintHashes.length; i++) {
    const { data } = await (
      await fetch(`https://blockscout.com/poa/xdai/graphiql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query: queries.txSender(chunkedMintHashes[i]) }),
      })
    ).json();
    const txDataArray = Object.keys(data).reduce((acc, curr) => {
      return [...acc, { ...data[curr] }];
    }, []);
    txDataArray.forEach((tx) => {
      mints.forEach((mint) => {
        if (mint.transaction.id === tx.hash) {
          finalMints.push({ fromAddressHash: tx.fromAddressHash, ...mint });
        }
      });
    });
  }
  for (let i = 0; i < chunkedBurnHashes.length; i++) {
    const { data } = await (
      await fetch(`https://blockscout.com/poa/xdai/graphiql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query: queries.txSender(chunkedBurnHashes[i]) }),
      })
    ).json();
    const txDataArray = Object.keys(data).reduce((acc, curr) => {
      return [...acc, { ...data[curr] }];
    }, []);
    txDataArray.forEach((tx) => {
      burns.forEach((burn) => {
        if (burn.transaction.id === tx.hash) {
          finalBurns.push({ fromAddressHash: tx.fromAddressHash, ...burn });
        }
      });
    });
  }
  return { mints: finalMints, burns: finalBurns };
};

(async (startTimestamp) => {
  const endTimestamp = startTimestamp + 604800;
  const hnyMintsAndBurns = await fetchMintsandBurns(
    '0xaaefc56e97624b57ce98374eb4a45b6fd5ffb982'
  );
  const xdaiMintsAndBurns = await fetchMintsandBurns(
    '0xa527dbc7cdb07dd5fdc2d837c7a2054e6d66daf4'
  );
  const accountMintsAndBurns = {
    mints: _.groupBy(
      [...hnyMintsAndBurns.mints, ...xdaiMintsAndBurns.mints],
      'fromAddressHash'
    ),
    burns: _.groupBy(
      [...hnyMintsAndBurns.burns, ...xdaiMintsAndBurns.burns],
      'fromAddressHash'
    ),
  };
  const accountsMintsBeforeTimestamp = Object.keys(
    accountMintsAndBurns.mints
  ).forEach((account) => {
    return accountMintsAndBurns.mints[account].map((entry) => {
      if (Number(entry.timestamp) < endTimestamp) {
        return entry;
      } else {
        return;
      }
    });
  });
  const accountsBurnsBeforeTimestamp = Object.keys(
    accountMintsAndBurns.burns
  ).forEach((account) => {
    const before = new BigNumber(0);
    accountMintsAndBurns.burns[account].map((entry) => {
      if (Number(entry.timestamp) < endTimestamp) {
        return entry;
      }
    });
  });
  console.log('accountsMintsBeforeTimestamp: ', accountsMintsBeforeTimestamp);
})();
