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
const LAST_MINTING_PATH = './distributions/2021-09-20.json';
const COLLAPSED_PARTICLES_IDENTITY_ID = 'apdevFNjKCe3aRZq8IxqKQ';

async function deductParticlesAlreadyMinted(accounts, ledger) {
  const LAST_MINTING = await converter.fromFile(LAST_MINTING_PATH);
  console.log('LAST_MINTING: ', LAST_MINTING);

  for (const address in LAST_MINTING) {
    const amount = LAST_MINTING[address];
  
    const account = accounts.find(a => a.ethAddress.toLowerCase() === address.toLowerCase());
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
  	console.log(`Extra PRTCLE Balance for: ${account.ethAddress}: ${G.sub(particlesMinted, particlesBalance)}`);
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

//   await deductParticlesAlreadyMinted([...accountsWithAddress], ledger);
//   await fs.writeFile(LEDGER_PATH, ledger.serialize());

  const addressAccounts = _.keyBy(accountsWithAddress, 'ethAddress');
  const newMintAmounts = {};
  let total = 0;
  accountsWithAddress.forEach((acc) => {
    const amountToMint = G.format(acc.balance, 9, '').replace(",","");
    newMintAmounts[acc.ethAddress] = amountToMint;
    if (!isValidAddress(acc.ethAddress)) {
      console.log('INVALID ADD for acc: ', acc);
    }

    total += parseFloat(amountToMint);
  });

  // DEPENDENCY_ACCOUNTS.forEach(dep => {
  //   const acc = ledger.account(dep.identity.id);
  //   const amountToMint = G.format(acc.balance, 9, '');
  //   newMintAmounts[dep.ethAddress] = amountToMint;
  //   total += parseFloat(amountToMint);
  // });

  console.log(
    Object.entries(newMintAmounts)
      .map(([address, amount]) => {
        const acc = addressAccounts[address];

        return `${acc && acc.identity.name},${address},${amount}`;
      })
      .join('\n')
  );
  console.log({ total });
  //
  fs.writeFile('./distributions/2021-09-20.json', JSON.stringify(newMintAmounts));
})();
