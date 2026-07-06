/*
USE:
- Search ports by name
- Get port coordinates
- Get harbor information
- Use port coordinates for route optimization
- Feed ports into your procurement orchestrator

API:
https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/World_Port_Index/FeatureServer/0/query
*/

const portName = "Singapore";

const url =
    `https://services.arcgis.com/hRUr1F8lE8Jq2uJo/arcgis/rest/services/World_Port_Index/FeatureServer/0/query?where=UPPER(PORT_NAME)%20LIKE%20UPPER('%25${encodeURIComponent(portName)}%25')&outFields=*&f=json`;

async function getPort() {

    const response = await fetch(url);
    const data = await response.json();

    console.log(data.features);
}

getPort();