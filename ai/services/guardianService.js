import axios from "axios";

export async function fetchGuardianNews() {
    const response = await axios.get(
        "https://content.guardianapis.com/search",
        {
            params: {
                q: "supply chain OR logistics OR shipping OR sanctions",
                "show-fields": "trailText",
                "page-size": 2,
                "api-key": process.env.GUARDIAN_API_KEY
            }
        }
    );

    return response.data.response.results.map(article => ({
        id: article.id,
        headline: article.webTitle,
        published_at: article.webPublicationDate,
        url: article.webUrl,
        summary: article.fields?.trailText || ""
    }));
}