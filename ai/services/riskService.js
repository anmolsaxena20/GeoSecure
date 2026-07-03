import { getEconomicProfile } from "../services/economicEnrichmentService.js";
import { COUNTRY_CODES } from "../utils/countryMap.js";

export async function computeRisk(event) {

    let score = 0;

    // Base event severity
    switch(event.event_type) {
        case "PORT_DISRUPTION":
            score += 30;
            break;

        case "SANCTIONS":
            score += 25;
            break;

        case "NATURAL_DISASTER":
            score += 20;
            break;

        case "ENERGY_SHOCK":
            score += 30;
            break;

        case "LABOR_STRIKE":
            score += 20;
            break;

        case "SHIPPING_DISRUPTION":
            score += 25;
            break;

        case "GEOPOLITICAL_EVENT":
            score += 15;
            break;
    }

    // Existing risk level
    switch(event.risk_level) {
        case "HIGH":
            score += 20;
            break;

        case "CRITICAL":
            score += 40;
            break;

        case "MEDIUM":
            score += 10;
            break;
    }

    // World Bank enrichment
    const country = event.countries?.[0];

    if (country && COUNTRY_CODES[country]) {
        try {
            const profile = await getEconomicProfile(
                COUNTRY_CODES[country]
            );

            console.log("Economic profile:", profile);

            // Trade dependent economy
            if (
                profile.trade_dependency_percent &&
                profile.trade_dependency_percent > 60
            ) {
                score += 10;
            }

            // Manufacturing heavy economy
            if (
                profile.manufacturing_share_percent &&
                profile.manufacturing_share_percent > 15
            ) {
                score += 5;
            }

            // Major container hub
            if (
                profile.container_traffic_teu &&
                profile.container_traffic_teu > 10000000
            ) {
                score += 10;
            }

            // Fuel dependent economy
            if (
                profile.fuel_import_percent &&
                profile.fuel_import_percent > 20
            ) {
                score += 5;
            }

        } catch(error) {
            console.log(
                "World Bank enrichment failed:",
                error.message
            );
        }
    }

    return Math.min(score, 100);
}