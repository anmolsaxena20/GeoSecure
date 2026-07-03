import cron from "node-cron";
import { generateSupplyChainReport } from "../controllers/reportController.js";
import { persistSupplyChainReport } from "../db/persistence.js";


export async function runCycle() {
    const report = await generateSupplyChainReport();

    console.log(JSON.stringify(report, null, 2));

    await persistSupplyChainReport(report);
}

cron.schedule("*/10 * * * *", async () => {
    await runCycle();
});

runCycle();