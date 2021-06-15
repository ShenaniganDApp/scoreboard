const mints = (pair) => {
	return `
{
    mints(where: {pair: "${pair}"},
    first:1000,
    orderBy:timestamp,
    orderDirection:asc) {,
      timestamp
      amountUSD
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
      transaction {
        id
      }
    }
  }
  `;
};

const txSender = (fragments) => {
	query = '{';

	fragments.forEach((hashes, index) => {
		query += `fragment transaction${index} on Transaction {`;
		hashes.forEach((hash) => {
			query += `tx${index}: transaction(hash:"${hash}") {fromAddressHash}\n`;
		});
		query += '}\n';
	});
	query += '}';
	console.log('query: ', query);
	return query;
};

module.exports = {
	mints,
	burns,
	txSender,
};
