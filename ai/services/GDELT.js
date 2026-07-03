import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = 'VPV8T9VTFV4XMURR';
const BASE_URL = "https://www.alphavantage.co/query";

async function fetchCommodity(functionName, interval = "monthly") {
    try {
        const response = await axios.get(BASE_URL, {
            params: {
                function: functionName,
                interval,
                apikey: API_KEY
            },
            timeout: 15000
        });

        if (response.data.Note) {
            console.log(`[${functionName}] Rate limit hit`);
            return null;
        }

        return response.data;
    }
    catch (err) {
        console.log(`[${functionName}] Failed: ${err.message}`);
        return null;
    }
}

async function fetchExchangeRate(from, to) {
    try {
        const response = await axios.get(BASE_URL, {
            params: {
                function: "CURRENCY_EXCHANGE_RATE",
                from_currency: from,
                to_currency: to,
                apikey: API_KEY
            }
        });

        return response.data;
    }
    catch (err) {
        return null;
    }
}

async function run() {
    const [
        brent,
        wti,
        naturalGas,
        copper,
        wheat,
        commoditiesIndex,
        usdInr
    ] = await Promise.all([
        fetchCommodity("BRENT"),
        fetchCommodity("WTI"),
        fetchCommodity("NATURAL_GAS"),
        fetchCommodity("COPPER"),
        fetchCommodity("WHEAT"),
        fetchCommodity("ALL_COMMODITIES"),
        fetchExchangeRate("USD", "INR")
    ]);

    const report = {
        generated_at: new Date().toISOString(),

        energy: {
            brent_latest:
                brent?.data?.[0] ?? null,

            wti_latest:
                wti?.data?.[0] ?? null,

            natural_gas_latest:
                naturalGas?.data?.[0] ?? null
        },

        manufacturing: {
            copper_latest:
                copper?.data?.[0] ?? null
        },

        food: {
            wheat_latest:
                wheat?.data?.[0] ?? null
        },

        macro: {
            commodity_index:
                commoditiesIndex?.data?.[0] ?? null,

            usd_inr:
                usdInr?.["Realtime Currency Exchange Rate"] ??
                null
        }
    };

    console.log(
        JSON.stringify(report, null, 2)
    );
}

run();