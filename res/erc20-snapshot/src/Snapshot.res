type snapshotOptions = {
  providerRpc: string,
  tokenAddresses: array<string>,
  fromBlock: int,
  toBlock: int,
  blocksPerBatch: int,
  delay: int,
  checkIfContract: bool,
}

let start = (option: snapshotOptions) => {
  let resultArray = []
}
