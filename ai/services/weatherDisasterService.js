export async function fetchChokepointWeather() {
  const hubs = [
    { name: "Suez Canal", lat: 29.97, lon: 32.53 },
    { name: "Panama Canal", lat: 9.08, lon: -79.69 },
    { name: "Port of Singapore", lat: 1.29, lon: 103.85 },
    { name: "Port of Rotterdam", lat: 51.92, lon: 4.48 },
    { name: "Port of Shanghai", lat: 31.23, lon: 121.47 }
  ];

  const weatherResults = [];

  for (const hub of hubs) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${hub.lat}&longitude=${hub.lon}&current=temperature_2m,wind_speed_10m,weather_code,rain`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      weatherResults.push({
        location: hub.name,
        temp_celsius: data.current?.temperature_2m,
        wind_speed_kmh: data.current?.wind_speed_10m,
        weather_code: data.current?.weather_code,
        rain_mm: data.current?.rain
      });
    } catch (error) {
      console.warn(`[weather] Failed to fetch weather for ${hub.name}:`, error.message);
      weatherResults.push({
        location: hub.name,
        error: error.message
      });
    }
  }

  return weatherResults;
}

export async function fetchNasaEonetEvents() {
  const url = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=10";
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }
    const data = await res.json();
    return (data.events || []).map(event => ({
      id: event.id,
      title: event.title,
      category: event.categories?.[0]?.title || "Unknown",
      date: event.geometry?.[0]?.date || "Unknown",
      coordinates: event.geometry?.[0]?.coordinates || []
    }));
  } catch (error) {
    console.warn("[weather] NASA EONET API failed, returning empty list. Reason:", error.message);
    return []; // Return empty list rather than throwing to avoid crashing agent cycle
  }
}
