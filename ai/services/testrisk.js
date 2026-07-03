import { getEconomicProfile }
from "../services/economicEnrichmentService.js";

const profile = await getEconomicProfile("DE");

console.log(profile);