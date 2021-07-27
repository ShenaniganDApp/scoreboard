const mints = (pair) => {
	return `
{
    mints(where: {pair: "${pair}"},
    first:1000,
    orderBy:timestamp,
    orderDirection:asc) {,
      timestamp
      amountUSD
      liquidity
      transaction {
        id
      }
    }
}
  `;
};

const burns = (pair) => {
	return `
{
    burns(where: {pair: "${pair}"},
          first:1000,
          orderBy:timestamp,
          orderDirection:asc) {
      timestamp
      amountUSD
      liquidity
      transaction {
        id
      }
    }
  }
  `;
};

const txSender = (hashes) => {
	query = '{';
	hashes.forEach((hash,index) => {
		query += `tx${index}: transaction(hash:"${hash}") {fromAddressHash, hash}\n`;
	});
	query += '}';
	return query;
};

module.exports = {
	mints,
	burns,
	txSender,
};
