import logo from './Kaspa-LDSP-Dark Reverse.svg';
import { Component } from 'react';
import { CSVLink } from 'react-csv';
import { Grid } from 'react-loader-spinner';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';
import { validateAddress } from './utils';
import { generateReport } from './report';
import './App.css';

const DONATION_ADDR = 'kaspa:qq6rz6q40e4t8sft4wsphwwlqm39pzc7ehwsprepe3d5szhkanuagfwd7lxrv';

class App extends Component {
  constructor(props) {
    super(props);

    const currentYear = new Date().getFullYear();
    const defaultStartDate = `${currentYear}-01-01`;
    const today = new Date();
    const defaultEndDate = today.toISOString().split('T')[0];

    this.state = {
      loading: false,
      generated: false,
      ignoreCompound: false,
      ignoreSentToSelf: false,
      hasSuggestions: false,
      suggestedAddresses: [],
      reportData: [],
      addresses: '',
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      dateError: null,
    };
  }

  validateDateRange = () => {
    if (!this.state.startDate || !this.state.endDate) return true;
    const start = new Date(this.state.startDate);
    const end = new Date(this.state.endDate);
    return start <= end;
  }

  handleDateChange = (type, value) => {
    this.setState({ [type]: value }, () => {
      const isValid = this.validateDateRange();
      this.setState({
        dateError: isValid ? null : 'Start Date must be before End Date'
      });
    });
  }

  beginReportGeneration() {
    this.setState({loading: true, generated: false, reportData: [], hasSuggestions: false, suggestedAddresses: []});

    const addresses = this.state.addresses.split('\n');

    const validAddresses = [];

    for (const address of addresses) {
      if (validateAddress(address)) {
        validAddresses.push(address);
      }
    }

    // Create dates in local timezone by using date parts
    const [startYear, startMonth, startDay] = this.state.startDate.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, startDay);
    startDate.setHours(0, 0, 0, 0);

    const [endYear, endMonth, endDay] = this.state.endDate.split('-').map(Number);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    endDate.setHours(23, 59, 59, 999);

    const startDateTimestamp = startDate.getTime();
    const endDateTimestamp = endDate.getTime();

    generateReport(addresses, startDateTimestamp, endDateTimestamp)
      .then(([txs, additionalAddressesFound = []]) => {

        let filteredTxs = txs;
        // Filter transactions by date range
        if (this.state.startDate || this.state.endDate) {
          filteredTxs = txs.filter(tx => {
            const txDate = new Date(tx.timestamp);
            const txTimestamp = txDate.getTime();
            return txTimestamp >= startDateTimestamp && txTimestamp <= endDateTimestamp;
          });
        }

        const reportData = [
          [
            "Date",
            "Sent Amount",
            "Sent Currency",
            "Received Amount",
            "Received Currency",
            "Fee Amount",
            "Fee Currency",
            "Label",
            "Description",
            "TxHash",
          ]
        ];

        let prev = null;

        for (const tx of filteredTxs) { 
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

          if (tx.sendAmount && tx.feeAmount) {
            rowData.push(tx.feeAmount);
            rowData.push('KAS');
          } else {
            rowData.push('');
            rowData.push('');
          }

          if (tx.label) {
            rowData.push(tx.label);
          } else {
            rowData.push('');
          }

          if (tx.description) {
            rowData.push(tx.description);
          } else {
            rowData.push('');
          }

          rowData.push(tx.txHash);

          reportData.push(rowData);

          prev = tx;
        }

        this.setState({
          reportData,
          generated: true,
          hasSuggestions: additionalAddressesFound.length > 0,
          suggestedAddresses: additionalAddressesFound,
        });
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
              alt="kaspa:youraddresseshere"
              placeholder='kaspa:youraddressesgoeshere'
              value={this.state.addresses}
              onChange={(event) => {this.setState({addresses: event.target.value})}}
              rows="5"
            >kaspa:youraddresseshere</textarea>

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

            {/* Date Range Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <label className="Checkboxes" style={{ marginRight: '0.5rem' }}>
                    Date Range:
                  </label>
                  <input
                    type="date"
                    value={this.state.startDate}
                    onChange={(event) => this.handleDateChange('startDate', event.target.value)}
                    style={{ marginLeft: '0.5rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <label className="Checkboxes" style={{ marginRight: '0.5rem' }}>
                    to
                  </label>
                  <input
                    type="date"
                    value={this.state.endDate}
                    onChange={(event) => this.handleDateChange('endDate', event.target.value)}
                    style={{ marginLeft: '0.5rem' }}
                  />
                </div>
              </div>
              {this.state.dateError && (
                <div style={{ color: 'red', fontSize: '0.6em' }}>
                  {this.state.dateError}
                </div>
              )}
            </div>
          </div>

          {/* Generate Report Button */}
          <button
            style={{ marginTop: '3rem', padding:`0.5rem` }}
            onClick={this.beginReportGeneration.bind(this)}
            disabled={this.state.loading || this.state.dateError}>
              <strong>Generate</strong>
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

          {
            this.state.hasSuggestions ?
            <div className="column SuggestionSection">
              <span className="App-instructions">
                These addresses may also belong to you. Check them in the <a href="https://explorer.kaspa.org" target="_blank" rel="noreferrer">explorer</a> and add them to your list if they are yours.
              </span>
              <textarea
                className="AddressesText"
                value={this.state.suggestedAddresses.join('\n')}
                readOnly={true}
                rows={Math.min(this.state.suggestedAddresses.length, 5)}
              ></textarea>
            </div>
            : ''
          }
        </div>

        <footer className="Footer">
          <div className="DonationQR">
            <QRCode style={{'width': '100%', 'height': '100%'}} value={DONATION_ADDR} />
          </div>
          <span>Found this useful? Consider donating at</span>
          <div className="DonationLink">
            <a href={'https://explorer.kaspa.org/addresses/' + DONATION_ADDR} rel="noreferrer" target="_blank">
              {DONATION_ADDR}
            </a>
          </div>
        </footer>
      </div>
    );
  }
}

export default App;
