const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijk2MDQ0NDE3YmRjNTQzNjk5YzU0YzUxNGNhNGMxMTZjIiwiaCI6Im11cm11cjY0In0=";

const url = "https://api.openrouteservice.org/v2/directions/driving-car";

const body = {
    coordinates: [
        [77.2090, 28.6139], // Delhi
        [72.8777, 19.0760]  // Mumbai
    ]
};

async function testOpenRouteService() {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("API Error:", data);
            return;
        }

        const summary = data.routes[0].summary;

        console.log("✅ Route found!");
        console.log(`Distance: ${(summary.distance / 1000).toFixed(2)} km`);
        console.log(`Duration: ${(summary.duration / 3600).toFixed(2)} hours`);

        console.log("\nFull Response:");
        console.log(JSON.stringify(data, null, 2));

    } catch (err) {
        console.error("Request failed:", err);
    }
}

testOpenRouteService();