const { error } = require('console');
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const EPOCHS_PATH = 'rewards/lastRewardEpoch.json';

const oneWeekInBlocks = 120992;

let incrementRewardEpoch = async () => {
  const epochData = await JSON.parse((await readFile(EPOCHS_PATH)).toString());
  epochData.endBlock = epochData.endBlock + oneWeekInBlocks;
  const data = await JSON.stringify(epochData);
  await fs.writeFile('rewards/lastRewardEpoch.json', data, (err) => {
    if (err) console.log(Error(err));
  });
};

module.exports = incrementRewardEpoch;
