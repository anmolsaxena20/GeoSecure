/*
USE:
- Convert procurement cost into local currency
- Compare supplier quotations
- Estimate landed procurement cost
*/

const url =
    "https://api.frankfurter.app/latest?from=USD&to=INR";

async function getExchangeRate() {

    const response = await fetch(url);
    const data = await response.json();

    console.log(data);
}

getExchangeRate();