exception CredError(string)
exception CSVReadError(string)

module Addressbook = {
  type entry = {
    name: string,
    createdAt: int,
    address: string,
    discordId: string,
  }

  type addressbook = array<entry>
  @scope("JSON") @val
  external parseIntoAddressbook: string => addressbook = "parse"

  let rec makeAddressBookMap = (~map=Belt.Map.String.empty, addressbook: list<entry>) => {
  switch addressbook {
  | list{} => map
  | list{entry, ...rest} => {
      let address = entry.address->Js.String2.toLowerCase
      let map = map->Belt.Map.String.set(address, entry)
      makeAddressBookMap(~map, rest)
    }
  }
}
}

module Sourcecred = {
  open ReScriptJs.Js
  type address
  type alias = {address: address, description: string}
  type aliases = array<alias>

  type identity = {id: string, subtype: string, aliases: aliases, name: string}

  type account = {identity: identity}
  type accountJSON = {account: account}

  type accounts = array<accountJSON>

  type accountsJSON = {accounts: accounts}

  type ledgerObj
  type ledger
  type nodeAddress
  type nodeAddressArgs = {
    name: string,
    nonce: string,
    otherNonces: Map.t<string, string>,
  }
  @module("sourcecred") @scope(("sourcecred", "ledger", "ledger"))
  external ledgerObj: ledgerObj = "Ledger"
  @module("sourcecred") @scope(("sourcecred", "core", "address"))
  external makeAddressModule: nodeAddressArgs => nodeAddress = "makeAddressModule"

  let nodeAddress = makeAddressModule({
    name: "NodeAddress",
    nonce: "N",
    otherNonces: Map.make()->Map.set("E", "EdgeAddress"),
  })

  @send external parseLedger: (ledgerObj, string) => ledger = "parse"
  @send external accounts: ledger => array<account> = "accounts"
  @send external toParts: (nodeAddress, address) => array<string> = "toParts"

  @scope("JSON") @val
  external parseIntoAccounts: string => accountsJSON = "parse"
}

@module("fs")
external appendFileSync: (
  ~name: string,
  ~content: string,
  [
    | #utf8
    | @as("ascii") #useAscii
  ],
) => string = "appendFileSync"

let chatDir = "data/fws-chat"

// Update value to desired Flow with SHE week
let dateOfYoga = "2022-04-01"
let lastChatWeek = `${chatDir}/${dateOfYoga}`

let instructorAddress = ""

let lineBreakRe = %re(`/\r?\n|\r/g`)
let addressRe = %re(`/0x[a-fA-F0-9]{40}$/`)
let nameRe = %re(`/\\t(.*?)\\:\t/`)

let readFileByLine = path => {
  let chatText = Node.Fs.readFileSync(path, #utf8)
  chatText->Js.String2.splitByRe(lineBreakRe)->Belt.List.fromArray
}

let addressBookPath = "data/addressbook.json"
let ledgerPath = "data/ledger.json"

let ledgerJSON = Node.Fs.readFileSync(ledgerPath, #utf8)
let addressbook =
  Node.Fs.readFileSync(addressBookPath, #utf8)
  ->Addressbook.parseIntoAddressbook
  ->Belt.List.fromArray

let accountsJSON = Node.Fs.readFileSync("output/accounts.json", #utf8)->Sourcecred.parseIntoAccounts



let rec makeUserMap = (~map=Belt.Map.String.empty, accounts: list<Sourcecred.accountJSON>) => {
  switch accounts {
  | list{} => map
  | list{accountJSON, ...rest} => {
      let map = map->Belt.Map.String.set(accountJSON.account.identity.id, accountJSON.account)
      makeUserMap(~map, rest)
    }
  }
}

let addressBookMap = addressbook->Addressbook.makeAddressBookMap
let userMap = accountsJSON.accounts->Belt.List.fromArray->makeUserMap

let ledger = Sourcecred.ledgerObj->Sourcecred.parseLedger(ledgerJSON)
let accounts = ledger->Sourcecred.accounts

let rec filterLines = (~addresses=list{}, lines) => {
  switch lines {
  | list{} => addresses
  | list{line, ...rest} =>
    switch line {
    | None => filterLines(~addresses, rest)
    | Some(line) => {
        let match = line->Js.String2.match_(addressRe)
        let split = line->Js.String2.splitByRe(nameRe)
        switch match {
        | None => filterLines(~addresses, rest)
        | Some(match) =>
          switch split[1] {
          | None => filterLines(~addresses, rest)
          | Some(name) => {
              let address = match[0]->Js.String.toLowerCase
              let addresses = list{`${address}, ${name}`, ...addresses}
              filterLines(~addresses, rest)
            }
          }
        }
      }
    }
  }
}

let saveToCSV = lines => {
  Node.Fs.writeFileSync(
    `${chatDir}/${dateOfYoga}.csv`,
    lines->Belt.List.toArray->Js.Array2.joinWith("\n"),
    #utf8,
  )
}

//uncomment to write CSV
readFileByLine(lastChatWeek ++ ".txt")->filterLines(_)->saveToCSV

let accountCred = readFileByLine(lastChatWeek ++ ".csv")->Belt.List.map(line => {
  let address = switch line {
  | None => CSVReadError("CSV read an empty line")->raise
  | Some(line) => Js.String2.split(line, ",")[0]->Js.String2.toLowerCase
  }
  let cred = 1
  (address, cred)
})

let accountCredMap = accountCred->Belt.List.toArray->Belt.Map.String.fromArray

let rec getEthAddressFromAliases = (~ethAddress="", ethAliases: list<Sourcecred.alias>) => {
  switch ethAliases {
  | list{} => ethAddress
  | list{alias, ...rest} => {
      let parts = Sourcecred.nodeAddress->Sourcecred.toParts(alias.address)
      let ethAddress = parts[2]
      getEthAddressFromAliases(rest, ~ethAddress)
    }
  }
}

let accountsWithAddress =
  accounts
  ->Belt.Array.map(account => {
    let credAcc = userMap->Belt.Map.String.get(account.identity.id)
    switch credAcc {
    | None => None
    | Some(_) =>
      switch account.identity.subtype === "BOT" {
      | true => None
      | false => {
          let ethAliases = account.identity.aliases->Belt.Array.keep(alias => {
            let parts = Sourcecred.nodeAddress->Sourcecred.toParts(alias.address)
            let index = parts->Belt.Array.getIndexBy(x => x === "ethereum")
            switch index {
            | None => false
            | Some(_) => true
            }
          })
          switch ethAliases->Belt.Array.length {
          | 0 => None
          | _ => {
              let ethAddress =
                ethAliases->Belt.List.fromArray->getEthAddressFromAliases->Js.String2.toLowerCase
              switch addressBookMap->Belt.Map.String.get(ethAddress) {
              | None => None
              | Some(_) => {
                  let cred = accountCredMap->Belt.Map.String.get(ethAddress)
                  switch cred {
                  | None => None
                  | Some(cred) =>
                    Some({
                      "account": account,
                      "ethAddress": ethAddress,
                      "amount": cred,
                      "instructor": ethAddress === instructorAddress,
                    })
                  }
                }
              }
            }
          }
        }
      }
    }
  })
  ->Belt.Array.keep(acc =>
    switch acc {
    | Some(_) => true
    | None => false
    }
  )

let entries = accountsWithAddress->Belt.Array.map(a => {
  open Js.Date
  switch a {
  | Some(a) =>
    switch a["instructor"] {
    | false =>
      `
        {
          "title": "Flow with SHE Attendee: @${a["account"].identity.name}",
          "timestampIso": "${fromString(dateOfYoga)->toISOString}",
          "weight": ${a["amount"]->Belt.Int.toString},
          "contributors": ["${a["account"].identity.name}"]
        }`
    | true => {
        let instructorAmount =
          ((accountsWithAddress->Belt.Array.length - 1)->Belt.Int.toFloat *. 0.2)
            ->Js.Float.toFixedWithPrecision(~digits=3)
        `{
          "title": "Flow with SHE Instructor: @${a["account"].identity.name}",
          "timestampIso": "${fromString(dateOfYoga)->toISOString}",
          "weight": ${instructorAmount},
          "contributors": ["${a["account"].identity.name}"]
        }`
      }
    }

  | None => ""
  }
})
let initiative = `[
      {
        "type": "sourcecred/initiativeFile",
        "version": "0.2.0"
      },
      {
        "title": "Flow With SHE ${Js.Date.fromString(dateOfYoga)->Js.Date.toISOString}",
        "timestampIso": "${Js.Date.fromString(dateOfYoga)->Js.Date.toISOString}",
        "weight": {
          "incomplete": 0,
          "complete": 0
        },
        "completed": true,
        "champions": [],
        "dependencies": {},
        "references": {},
        "contributions":{
          "entries": [${entries->Js.Array2.toString}]
      }
    }]`
Js.log(entries)

let writeInitiative = () => {
  open Js.Date

  let date = fromString(dateOfYoga)->toISOString->Js.String2.split("-")

  Node.Fs.writeFileSync(
    `config/plugins/sourcecred/initiatives/initiatives/${date[0]}-${date[1]}-flow-with-she.json`,
    initiative,
    #utf8,
  )
}

writeInitiative()
