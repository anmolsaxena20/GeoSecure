import { fetchGuardianNews } from "../services/guardianService.js";

export async function fetchAllNews() {
    const guardian = await fetchGuardianNews();

    return guardian.slice(0, 5);
}