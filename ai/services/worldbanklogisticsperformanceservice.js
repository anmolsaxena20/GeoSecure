/*
USE:
- Compare logistics efficiency across countries
- Rank procurement destinations
- Improve route selection
- Estimate customs delays
*/

const url =
    "https://api.worldbank.org/v2/country/IND/indicator/LP.LPI.OVRL.XQ?format=json";

async function getLPI() {

    const response = await fetch(url);

    const data = await response.json();

    console.log(data[1][0]);
}

getLPI();