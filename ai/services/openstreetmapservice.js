/*
USE:
- Convert supplier or port names into coordinates
- Plot logistics routes
- Calculate nearest ports
- Feed coordinates into routing algorithms
*/

const port = "Port of Singapore";

const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(port)}&format=json`;

async function locatePort() {

    const response = await fetch(url, {
        headers: {
            "User-Agent": "SupplyChainAgent"
        }
    });

    const data = await response.json();

    console.log(data[0]);
}

locatePort();