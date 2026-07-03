import { getIndicator } from "./worldBankService.js";

export async function getEconomicProfile(countryCode) {
    const [
        tradeDependency,
        manufacturingShare,
        fuelImports,
        containerTraffic
    ] = await Promise.all([
        getIndicator(countryCode, "TG.VAL.TOTL.GD.ZS"),
        getIndicator(countryCode, "NV.IND.MANF.ZS"),
        getIndicator(countryCode, "TM.VAL.FUEL.ZS.UN"),
        getIndicator(countryCode, "IS.SHP.GOOD.TU")
    ]);

    return {
        trade_dependency_percent:
            tradeDependency?.value,

        manufacturing_share_percent:
            manufacturingShare?.value,

        fuel_import_percent:
            fuelImports?.value,

        container_traffic_teu:
            containerTraffic?.value
    };
}