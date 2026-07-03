import axios from "axios";

export async function getMarketSnapshot() {
    return {
        energy: {
            brent_crude_price: await getOilPrice()
        },
        forex: {
            usd_inr: await getUsdInr()
        }
    };
}

async function getOilPrice() {
    return "72.5";
}

async function getUsdInr() {
    return "85.5";
}