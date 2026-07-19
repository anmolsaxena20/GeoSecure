import axios from "axios";

const API_KEY = "9iYzjleDfNinyvRU7VBezgaiU1C7DI0Sshad8XST";

async function testEIA() {
    try {
        const response = await axios.get(
            "https://api.eia.gov/v2/petroleum/pri/spt/data",
            {
                params: {
                    api_key: API_KEY,
                    frequency: "daily",
                    "data[0]": "value",
                    "facets[product][]": "EPCBRENT",
                    "sort[0][column]": "period",
                    "sort[0][direction]": "desc",
                    offset: 0,
                    length: 5
                }
            }
        );

        console.log("✅ API Connected Successfully\n");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {

        console.error("❌ API Error");

        if (error.response) {
            console.log(error.response.status);
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }

    }
}

testEIA();