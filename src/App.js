import logo from './Kaspa-LDSP-Dark Reverse.svg';
import donationQR from './donation-qr.png';
import { Component } from 'react';
import { CSVLink } from 'react-csv';
import { Grid } from 'react-loader-spinner';
import { format } from 'date-fns';
import { validateAddress } from './utils';
import { generateReport } from './report';
import './App.css';

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      generated: false,
      ignoreCompound: true,
      ignoreSentToSelf: true,
      reportData: [],
      addresses: ''
    };
  }

  beginReportGeneration() {
    this.setState({loading: true, generated: false, reportData: []});

    const addresses = this.state.addresses.split('\n');

    const validAddresses = [];

    for (const address of addresses) {
      if (validateAddress(address)) {
        validAddresses.push(address);
      }
    }

    generateReport(addresses)
      .then((txs) => {
        const reportData = [
          [
            "Date",
            "Sent Amount",
            "Sent Currency",
            "Received Amount",
            "Received Currency",
            "Fee Amount",
            "Fee Currency",
            "TxHash",
          ]
        ];

        let prev = null;

        for (const tx of txs) {
          if (this.state.ignoreCompound && tx.compound) {
            continue;
          }

          if (this.state.ignoreSentToSelf && this.sendToSelf) {
            continue;
          }

          if (prev && prev.txHash === tx.txHash) {
            continue;
          } 

          const rowData = [tx.timestamp];

          if (tx.sendAmount) {
            rowData.push(tx.sendAmount);
            rowData.push('KAS');
          } else {
            rowData.push('');
            rowData.push('');
          }

          if (tx.receiveAmount) {
            rowData.push(tx.receiveAmount);
            rowData.push('KAS');
          } else {
            rowData.push('');
            rowData.push('');
          }

          if (tx.sendAmount || tx.compound || this.sendToSelf) {
            rowData.push(tx.feeAmount);
            rowData.push('KAS');
          } else {
            rowData.push('');
            rowData.push('');
          }

          rowData.push(tx.txHash);

          reportData.push(rowData);

          prev = tx;
        }

        this.setState({reportData, generated: true});
      })
      .catch(console.error)
      .finally(() => {
        this.setState({loading: false});
      });
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <span className="App-banner-text">Transaction Report</span>
        </header>

        <div className="AppContent">
          <span className="App-instructions">Add your kaspa addressess below (one per line) then click Generate to download your transaction history as a CSV file</span>
          <div className="column InputContainer">
            <textarea
              className="AddressesText"
              alt="kaspa:youradresseshere"
              placeholder='kaspa:youraddressesgoeshere'
              value={this.state.addresses}
              onChange={(event) => {this.setState({addresses: event.target.value})}}
              rows="5"
            >kaspa:youradresseshere</textarea>

            <label className="Checkboxes">
              <input
                type="checkbox"
                checked={this.state.ignoreCompound}
                onChange={() => {
                  this.setState({ignoreCompound: !this.state.ignoreCompound});
                }}
              />

              Ignore Compound Transactions
            </label>

            <label className="Checkboxes">
              <input
                type="checkbox"
                checked={this.state.ignoreSentToSelf}
                className="Checkboxes"
                onChange={() => {
                  this.setState({ignoreSentToSelf: !this.state.ignoreSentToSelf});
                }}
              />
              Ignore transactions sent to self
            </label>
          </div>
          <button
            onClick={this.beginReportGeneration.bind(this)}
            disabled={this.state.loading}>
              Generate
          </button>

          <Grid
            height="60"
            width="60"
            color = '#49EACB'
            ariaLabel="grid-loading"
            radius="12.5"
            wrapperStyle={{"marginTop": "1em"}}
            wrapperClass=""
            visible={this.state.loading}
          />

          {
            this.state.generated ?
            <CSVLink
              className="DownloadLink"
              data={this.state.reportData}
              filename={"kaspa-transactions-" + (format(new Date(), 'yyyyMMdd-HHmmss')) + ".csv"}
              target="_blank"
            >Download Report</CSVLink> :
            ''
          }
        </div>

        <footer className="Footer">
          <img src={donationQR} alt="kaspa:qq6rz6q40e4t8sft4wsphwwlqm39pzc7ehwsprepe3d5szhkanuagfwd7lxrv" />
          <span>Found this useful? Consider donating at</span>
          <div className="DonationLink">
            <a href="https://explorer.kaspa.org/addresses/kaspa:qq6rz6q40e4t8sft4wsphwwlqm39pzc7ehwsprepe3d5szhkanuagfwd7lxrv">
              kaspa:qq6rz6q40e4t8sft4wsphwwlqm39pzc7ehwsprepe3d5szhkanuagfwd7lxrv
            </a>
          </div>
        </footer>
      </div>
    );
  }
}

export default App;
