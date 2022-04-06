// Generated by ReScript, PLEASE EDIT WITH CARE
'use strict';

var Fs = require("fs");
var Belt_List = require("rescript/lib/js/belt_List.js");
var Belt_Array = require("rescript/lib/js/belt_Array.js");
var Caml_array = require("rescript/lib/js/caml_array.js");
var Sourcecred = require("sourcecred");
var Caml_option = require("rescript/lib/js/caml_option.js");
var Belt_MapString = require("rescript/lib/js/belt_MapString.js");
var Caml_exceptions = require("rescript/lib/js/caml_exceptions.js");

var CredError = /* @__PURE__ */Caml_exceptions.create("FlowWithSHE.CredError");

var CSVReadError = /* @__PURE__ */Caml_exceptions.create("FlowWithSHE.CSVReadError");

function makeAddressBookMap(_mapOpt, _addressbook) {
  while(true) {
    var mapOpt = _mapOpt;
    var addressbook = _addressbook;
    var map = mapOpt !== undefined ? Caml_option.valFromOption(mapOpt) : undefined;
    if (!addressbook) {
      return map;
    }
    var entry = addressbook.hd;
    var address = entry.address.toLowerCase();
    var map$1 = Belt_MapString.set(map, address, entry);
    _addressbook = addressbook.tl;
    _mapOpt = Caml_option.some(map$1);
    continue ;
  };
}

var Addressbook = {
  makeAddressBookMap: makeAddressBookMap
};

var nodeAddress = Sourcecred.sourcecred.core.address.makeAddressModule({
      name: "NodeAddress",
      nonce: "N",
      otherNonces: new Map().set("E", "EdgeAddress")
    });

var Sourcecred$1 = {
  nodeAddress: nodeAddress
};

var chatDir = "data/fws-chat";

var dateOfYoga = "2022-04-01";

var lastChatWeek = chatDir + "/" + dateOfYoga;

var instructorAddress = "0x58315fB2b6E94371679fFb4b3322ab32f3dc7311".toLowerCase();

var lineBreakRe = /\r?\n|\r/g;

var addressRe = /0x[a-fA-F0-9]{40}$/;

var nameRe = /\t(.*?)\:\t/;

function readFileByLine(path) {
  var chatText = Fs.readFileSync(path, "utf8");
  return Belt_List.fromArray(chatText.split(lineBreakRe));
}

var addressBookPath = "data/addressbook.json";

var ledgerPath = "data/ledger.json";

var ledgerJSON = Fs.readFileSync(ledgerPath, "utf8");

var addressbook = Belt_List.fromArray(JSON.parse(Fs.readFileSync(addressBookPath, "utf8")));

var accountsJSON = JSON.parse(Fs.readFileSync("output/accounts.json", "utf8"));

function makeUserMap(_mapOpt, _accounts) {
  while(true) {
    var mapOpt = _mapOpt;
    var accounts = _accounts;
    var map = mapOpt !== undefined ? Caml_option.valFromOption(mapOpt) : undefined;
    if (!accounts) {
      return map;
    }
    var accountJSON = accounts.hd;
    var map$1 = Belt_MapString.set(map, accountJSON.account.identity.id, accountJSON.account);
    _accounts = accounts.tl;
    _mapOpt = Caml_option.some(map$1);
    continue ;
  };
}

var addressBookMap = makeAddressBookMap(undefined, addressbook);

var userMap = makeUserMap(undefined, Belt_List.fromArray(accountsJSON.accounts));

var ledger = Sourcecred.sourcecred.ledger.ledger.Ledger.parse(ledgerJSON);

var accounts = ledger.accounts();

function filterLines(_addressesOpt, _lines) {
  while(true) {
    var addressesOpt = _addressesOpt;
    var lines = _lines;
    var addresses = addressesOpt !== undefined ? addressesOpt : /* [] */0;
    if (!lines) {
      return addresses;
    }
    var rest = lines.tl;
    var line = lines.hd;
    if (line !== undefined) {
      var match = line.match(addressRe);
      var split = line.split(nameRe);
      if (match !== null) {
        var name = Caml_array.get(split, 1);
        if (name !== undefined) {
          var address = Caml_array.get(match, 0).toLowerCase();
          var addresses_0 = address + ", " + name;
          var addresses$1 = {
            hd: addresses_0,
            tl: addresses
          };
          _lines = rest;
          _addressesOpt = addresses$1;
          continue ;
        }
        _lines = rest;
        _addressesOpt = addresses;
        continue ;
      }
      _lines = rest;
      _addressesOpt = addresses;
      continue ;
    }
    _lines = rest;
    _addressesOpt = addresses;
    continue ;
  };
}

function saveToCSV(lines) {
  Fs.writeFileSync(chatDir + "/" + dateOfYoga + ".csv", Belt_List.toArray(lines).join("\n"), "utf8");
  
}

saveToCSV(filterLines(undefined, readFileByLine(lastChatWeek + ".txt")));

var accountCred = Belt_List.add(Belt_List.map(readFileByLine(lastChatWeek + ".csv"), (function (line) {
            var address;
            if (line !== undefined) {
              address = Caml_array.get(line.split(","), 0).toLowerCase();
            } else {
              throw {
                    RE_EXN_ID: CSVReadError,
                    _1: "CSV read an empty line",
                    Error: new Error()
                  };
            }
            return [
                    address,
                    1
                  ];
          })), [
      instructorAddress,
      1
    ]);

var accountCredMap = Belt_MapString.fromArray(Belt_List.toArray(accountCred));

function getEthAddressFromAliases(_ethAddressOpt, _ethAliases) {
  while(true) {
    var ethAddressOpt = _ethAddressOpt;
    var ethAliases = _ethAliases;
    var ethAddress = ethAddressOpt !== undefined ? ethAddressOpt : "";
    if (!ethAliases) {
      return ethAddress;
    }
    var parts = nodeAddress.toParts(ethAliases.hd.address);
    var ethAddress$1 = Caml_array.get(parts, 2);
    _ethAliases = ethAliases.tl;
    _ethAddressOpt = ethAddress$1;
    continue ;
  };
}

var accountsWithAddress = Belt_Array.keep(Belt_Array.map(accounts, (function (account) {
            var credAcc = Belt_MapString.get(userMap, account.identity.id);
            if (credAcc === undefined) {
              return ;
            }
            if (account.identity.subtype === "BOT") {
              return ;
            }
            var ethAliases = Belt_Array.keep(account.identity.aliases, (function (alias) {
                    var parts = nodeAddress.toParts(alias.address);
                    return Belt_Array.getIndexBy(parts, (function (x) {
                                  return x === "ethereum";
                                })) !== undefined;
                  }));
            var match = ethAliases.length;
            if (match === 0) {
              return ;
            }
            var ethAddress = getEthAddressFromAliases(undefined, Belt_List.fromArray(ethAliases)).toLowerCase();
            var match$1 = Belt_MapString.get(addressBookMap, ethAddress);
            if (match$1 === undefined) {
              return ;
            }
            var cred = Belt_MapString.get(accountCredMap, ethAddress);
            if (cred !== undefined) {
              return {
                      account: account,
                      ethAddress: ethAddress,
                      amount: cred,
                      instructor: ethAddress === instructorAddress
                    };
            }
            
          })), (function (acc) {
        return acc !== undefined;
      }));

var entries = Belt_Array.map(accountsWithAddress, (function (a) {
        if (a === undefined) {
          return "";
        }
        var a$1 = Caml_option.valFromOption(a);
        if (!a$1.instructor) {
          return "\n        {\n          \"title\": \"Flow with SHE Attendee: @" + a$1.account.identity.name + "\",\n          \"timestampIso\": \"" + new Date(dateOfYoga).toISOString() + "\",\n          \"weight\": " + String(a$1.amount) + ",\n          \"contributors\": [\"" + a$1.account.identity.name + "\"]\n        }";
        }
        var instructorAmount = ((accountsWithAddress.length - 1 | 0) * 0.2).toFixed(3);
        return "{\n          \"title\": \"Flow with SHE Instructor: @" + a$1.account.identity.name + "\",\n          \"timestampIso\": \"" + new Date(dateOfYoga).toISOString() + "\",\n          \"weight\": " + instructorAmount + ",\n          \"contributors\": [\"" + a$1.account.identity.name + "\"]\n        }";
      }));

var initiative = "[\n      {\n        \"type\": \"sourcecred/initiativeFile\",\n        \"version\": \"0.2.0\"\n      },\n      {\n        \"title\": \"Flow With SHE " + new Date(dateOfYoga).toISOString() + "\",\n        \"timestampIso\": \"" + new Date(dateOfYoga).toISOString() + "\",\n        \"weight\": {\n          \"incomplete\": 0,\n          \"complete\": 0\n        },\n        \"completed\": true,\n        \"champions\": [],\n        \"dependencies\": {},\n        \"references\": {},\n        \"contributions\":{\n          \"entries\": [" + entries.toString() + "]\n      }\n    }]";

function writeInitiative(param) {
  var date = new Date(dateOfYoga).toISOString().split("-");
  Fs.writeFileSync("config/plugins/sourcecred/initiatives/initiatives/" + Caml_array.get(date, 0) + "-" + Caml_array.get(date, 1) + "-flow-with-she.json", initiative, "utf8");
  
}

writeInitiative(undefined);

exports.CredError = CredError;
exports.CSVReadError = CSVReadError;
exports.Addressbook = Addressbook;
exports.Sourcecred = Sourcecred$1;
exports.chatDir = chatDir;
exports.dateOfYoga = dateOfYoga;
exports.lastChatWeek = lastChatWeek;
exports.instructorAddress = instructorAddress;
exports.lineBreakRe = lineBreakRe;
exports.addressRe = addressRe;
exports.nameRe = nameRe;
exports.readFileByLine = readFileByLine;
exports.addressBookPath = addressBookPath;
exports.ledgerPath = ledgerPath;
exports.ledgerJSON = ledgerJSON;
exports.addressbook = addressbook;
exports.accountsJSON = accountsJSON;
exports.makeUserMap = makeUserMap;
exports.addressBookMap = addressBookMap;
exports.userMap = userMap;
exports.ledger = ledger;
exports.accounts = accounts;
exports.filterLines = filterLines;
exports.saveToCSV = saveToCSV;
exports.accountCred = accountCred;
exports.accountCredMap = accountCredMap;
exports.getEthAddressFromAliases = getEthAddressFromAliases;
exports.accountsWithAddress = accountsWithAddress;
exports.entries = entries;
exports.initiative = initiative;
exports.writeInitiative = writeInitiative;
/* nodeAddress Not a pure module */
