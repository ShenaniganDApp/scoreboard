const { encodeCallScript } = require("@aragon/test-helpers/evmScript");
const { encodeActCall } = require("@aragon/toolkit");

const {
  daoAddress,
  financeAddress,
  votingAddress,
  tokenAddress,
  mints,
  burns,
  environment,
} = require("./transactionSettings.json")[0];

async function main() {
  // Encode a bunch of token transfers
  const transferSignature = "newImmediatePayment(address, address, uint256, string)";
  const calldatum = await Promise.all([
    ...mints.map(([receiverAddress, amount]) =>
      encodeActCall(transferSignature, [tokenAddress, receiverAddress, amount, "Transfer4"])
    )
  ]);

  const actions = calldatum.map((calldata) => ({
    to: financeAddress,
    calldata,
  }));
  // Encode all actions into a single EVM script.
  const script = encodeCallScript(actions);
  console.log(
    `npx dao exec ${daoAddress} ${votingAddress} newVote ${script} mintsandburns --environment ${environment} `
  );

  process.exit();
}

main();
