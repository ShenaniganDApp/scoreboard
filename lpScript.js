const _ = require('lodash');

const fs = require('fs')
const BigNumber = require('bignumber.js');

const hnyMints = require('./hny-prtcle-mints').data.mints
const hnyBurns = require('./hny-prtcle-burns').data.burns
const xdaiMints = require('./xdai-prtcle-mints').data.mints
const xdaiBurns = require('./xdai-prtcle-burns').data.burns
const xdaiPrtcleAddress = '0xa527dbc7cdb07dd5fdc2d837c7a2054e6d66daf4'
const hnyPrtcleAddress = '0xaaefc56e97624b57ce98374eb4a45b6fd5ffb982'



const hnyMintMap = _.groupBy(hnyMints, 'to')

async function liquidityCheck() {
    var output =
        _(hnyMintMap)
            .map((objs, key) => ({
                'to': key,
                'amountUSD': _.sumBy(objs, function (o) { return Number(o.amountUSD) })

            })).value()

    console.log('output: ', output);
}


liquidityCheck();
