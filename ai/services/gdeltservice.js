/*
USE:
- Detect wars
- Detect sanctions
- Detect port strikes
- Detect natural disasters
- Detect geopolitical disruptions
- Trigger procurement orchestration
*/

const query = "oil";

const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&maxrecords=5&format=json`;

async function getEvents() {

    const response = await fetch(url);
    const data = await response.json();

    console.log(data.articles);
}

getEvents();