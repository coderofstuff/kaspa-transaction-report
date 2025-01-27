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

    this.state = {
      loading: false,
      generated: false,
      ignoreCompound: false,
      ignoreSentToSelf: false,
      hasSuggestions: false,
      suggestedAddresses: [],
      reportData: [],
      addresses: '',
      selectYear: false,
      currentDropdownYear: null,
      selectedYears: [],
    };
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

    generateReport(addresses)
      .then(([txs, additionalAddressesFound = []]) => {
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
    const yearOptions = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

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

            {/* Section: Select Year */}
            <div style={{ display: 'flex', alignItems: 'center'}}>
              <label className="Checkboxes" style={{ marginRight: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={this.state.selectYear}
                  onChange={() => {
                    const toggled = !this.state.selectYear;
                    this.setState({
                      selectYear: toggled,
                      currentDropdownYear: toggled ? new Date().getFullYear() : null,    
                      selectedYears: toggled ? this.state.selectedYears : [] 
                    });
                  }}
                />
                Select Years
              </label>

              {/* Vis: If option enabled, display dropdowns*/}
              {this.state.selectYear && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <select
                    style={{ marginLeft: '0.5rem' }}
                    value={this.state.currentDropdownYear || ''}
                    onChange={(event) =>
                      this.setState({ currentDropdownYear: parseInt(event.target.value, 10) })
                    }
                  >
                    <option value="" disabled>
                      Select a year
                    </option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  {/* Array of selected Years */}
                  <button
                    style={{ marginLeft: '0.5rem' }}
                    onClick={() => {
                      const { currentDropdownYear, selectedYears } = this.state;
                      // Add year if its nots already in array
                      if (
                        currentDropdownYear &&
                        !selectedYears.includes(currentDropdownYear)
                      ) {
                        this.setState({
                          selectedYears: [...selectedYears, currentDropdownYear],
                        });
                      }
                    }}
                  >
                    Add Year
                  </button>
                </div>
              )}
            </div>
 
            {/* Display the years, allow user to delete */}
            {this.state.selectedYears.length > 0 && (
              <>
              <div style={{
                  marginTop: '0.5rem',
                  fontSize: '1rem',
                  marginLeft: '1rem',
                }}>
                  <strong>Selected Years:</strong> {this.state.selectedYears.join(', ')}
               <button
               style={{ marginLeft: '0.5rem' }}
               onClick={() => {this.setState({
                selectedYears: this.state.selectedYears.pop});
               }}
             >
               Delete
             </button>
             </div>
             </>
            )}
          </div>

          {/* Generate Report Button */}
          <button
          style={{ marginTop: '3rem', padding:`0.5rem` }}
            onClick={this.beginReportGeneration.bind(this)}
            disabled={this.state.loading}>
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
