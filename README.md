# Kaspa Transaction Report

Generates a CSV file for all your Kaspa transactions.

Currently in alpha - no expected SLA.

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

## Debugging

If you notice the report is inaccurate, first make sure you actually listed all addresses you care about in `addresses.txt`

## Found this useful?

Consider donating to `kaspa:qq6rz6q40e4t8sft4wsphwwlqm39pzc7ehwsprepe3d5szhkanuagfwd7lxrv`
