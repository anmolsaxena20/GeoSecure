export function calculateRisk(event) {

    let score = 0;

    const weights = {
        PORT_DISRUPTION: 40,
        SHIPPING_DISRUPTION: 35,
        LABOR_STRIKE: 25,
        SANCTIONS: 30,
        ENERGY_SHOCK: 30,
        NATURAL_DISASTER: 35,
        GEOPOLITICAL_EVENT: 20
    };

    score += weights[event.event_type] || 10;

    score += Math.min(
        (event.countries?.length || 0) * 5,
        20
    );

    if(event.transport_modes?.includes("Ocean"))
        score += 20;

    if(event.transport_modes?.includes("Air"))
        score += 10;

    score += (event.severity || 0) * 2;

    score = Math.min(score,100);

    let level = "LOW";

    if(score >= 80) level = "CRITICAL";
    else if(score >= 60) level = "HIGH";
    else if(score >= 40) level = "MEDIUM";

    return {
        risk_score: score,
        risk_level: level
    };
}