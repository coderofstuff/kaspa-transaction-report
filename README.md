# Kaspa Transaction Report

Generates a CSV file for all your Kaspa transactions.

Currently in alpha - no expected SLA.

## Want to just get to generating your report?

You can use the deployment at https://kaspa-transaction-report.vercel.app/

## Requirement

- NodeJS (v16+)

## Usage

1. Download this repository and unzip (or clone it if you know how)
2. Open a terminal/cmd and go to the directory you downloaded this at, then run `npm install`. This will install dependencies.
3. Create a file `addresses.txt` in this directory. In this file, you will list all your address - one per line
```
kaspa:myaddress
kaspa:myotheraddress
kaspa:anotherone
```
4. To generate your transaction report run `npm run generate`

This will generate the file `kaspa-transactions.csv`. This CSV is currently compatible with Koinly only.

## Notes
- Compound transactions and transactions sending to yourself are ignored
- Assumes addresses from exchanges are treated as not your own
- If you notice the report is inaccurate, first make sure you actually listed all addresses you care about in `addresses.txt`
- There is the ability to select certain years.
  1. Tick the `Select Specific Years` checkbox
  2. Select year from drop down
  3. Add year
  4. (optional) Add more years using steps 2 & 3
  5. (optional) Delete years if you've selected the wrong one

 ## Found this useful?

Consider donating to `kaspa:qq6rz6q40e4t8sft4wsphwwlqm39pzc7ehwsprepe3d5szhkanuagfwd7lxrv`
