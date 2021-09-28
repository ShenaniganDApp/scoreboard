const sc = require('sourcecred').sourcecred;
const fs = require('fs-extra');
const _ = require('lodash');
const isValidAddress = require('web3-utils').isAddress;
const Ledger = sc.ledger.ledger.Ledger;
const G = sc.ledger.grain;

const BigNumber = require('bignumber.js');

const NodeAddress = sc.core.address.makeAddressModule({
  name: 'NodeAddress',
  nonce: 'N',
  otherNonces: new Map().set('E', 'EdgeAddress'),
});

const LEDGER_PATH = '../data/ledger.json';
const DEPENDENCIES_PATH = '../config/dependencies.json';
const address_book_file =
  'https://raw.githubusercontent.com/ShenaniganDApp/scoreboard/master/data/addressbook.json';
const MINT_AMOUNTS_PATH = './distributions/2021-09-20.json';
const COLLAPSED_PARTICLES_IDENTITY_ID = 'apdevFNjKCe3aRZq8IxqKQ';

const MINT_DATE = 'Sep 27 2021';

async function deductParticlesAlreadyMinted(accounts, ledger) {
  const LAST_MINTING = JSON.parse(await fs.readFile(MINT_AMOUNTS_PATH));

  for (const address in LAST_MINTING) {
    const amount = LAST_MINTING[address];

    const account = accounts.find(
      (a) => a.ethAddress.toLowerCase() === address.toLowerCase()
    );
    if (!account) {
      console.warn('Missing account for: ', address);
    }

    const particlesMinted = G.fromApproximateFloat(amount);
    const particlesBalance = G.fromString(account.balance);
    // console.log({ particlesBalance, particlesMinted, mint });
    // console.log({ address, amount, particlesMinted });

    let transferAmount = particlesMinted;
    // Only transfer up to max balance
    if (G.lt(particlesBalance, particlesMinted)) {
      console.log(
        `Extra PRTCLE Balance for: ${account.ethAddress}: ${G.sub(
          particlesMinted,
          particlesBalance
        )}`
      );
      transferAmount = particlesBalance;
    }
    ledger.activate(account.identity.id);
    ledger.transferGrain({
      from: account.identity.id,
      to: COLLAPSED_PARTICLES_IDENTITY_ID,
      amount: transferAmount,
      memo: `Minted PRTCLE on chain to ${account.ethAddress} on ${MINT_DATE}`,
    });
  }
}

(async function () {
  const ledgerJSON = (await fs.readFile(LEDGER_PATH)).toString();

  const ledger = Ledger.parse(ledgerJSON);
  const accounts = ledger.accounts();

  const accountsWithAddress = accounts
    .map((a) => {
      if (a.identity.subtype === 'BOT') return null;

      const ethAliases = a.identity.aliases.filter((alias) => {
        const parts = NodeAddress.toParts(alias.address);
        return parts.indexOf('ethereum') > 0;
      });

      if (!ethAliases.length) return null;

      let ethAddress = null;

      ethAliases.forEach((alias) => {
        ethAddress = NodeAddress.toParts(alias.address)[2];
      });

      return {
        ...a,
        ethAddress: ethAddress,
      };
    })
    .filter(Boolean);

  // const depAccounts = DEPENDENCY_ACCOUNTS.map(dep => ({
  //   ...(ledger.account(dep.identity.id)),
  //   ...dep,
  // }));

  // Uncomment these two lines below and rerun script after distribution is on chain and MINT_DATE is updated.
  // await deductParticlesAlreadyMinted([...accountsWithAddress], ledger);
  // await fs.writeFile(LEDGER_PATH, ledger.serialize());

  const addressAccounts = _.keyBy(accountsWithAddress, 'ethAddress');
  const newMintAmounts = {};
  let total = 0;
  accountsWithAddress.forEach((acc) => {
    if (new BigNumber(acc.balance).gt(1e+18)) {
      const amountToMint = G.format(acc.balance, 9, '').replace(',', '');
      newMintAmounts[acc.ethAddress] = amountToMint;
      if (!isValidAddress(acc.ethAddress)) {
        console.log('INVALID ADD for acc: ', acc);
      }

      total += parseFloat(amountToMint);
    }
  });

  console.log(
    Object.entries(newMintAmounts)
      .map(([address, amount]) => {
        const acc = addressAccounts[address];

        return `${address},${amount}`;
      })
      .join('\n')
  );
  //
  fs.writeFile(
    './distributions/json/2021-09-27.json',
    JSON.stringify(newMintAmounts)
  );
})();
