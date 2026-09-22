import type { Weather } from "@/lib/suggest/engine";

/**
 * Free, key-less weather for grill-night decisions: Zippopotam turns a US
 * ZIP into coordinates once, then Open-Meteo gives a 16-day daily forecast.
 * Any failure just means "no weather info"; planning never depends on it.
 */

export async function locateZip(zip: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { places?: { latitude: string; longitude: string }[] };
    const place = data.places?.[0];
    if (!place) return null;
    return { latitude: Number(place.latitude), longitude: Number(place.longitude) };
  } catch {
    return null;
  }
}

type OpenMeteoDaily = {
  daily?: { time: string[]; temperature_2m_max: number[]; precipitation_probability_max: (number | null)[] };
};

export function parseForecast(data: OpenMeteoDaily): Map<string, Weather> {
  const result = new Map<string, Weather>();
  const daily = data.daily;
  if (!daily) return result;
  daily.time.forEach((date, i) => {
    const tempMaxF = daily.temperature_2m_max[i];
    if (typeof tempMaxF !== "number") return;
    result.set(date, { tempMaxF, precipChance: daily.precipitation_probability_max[i] ?? 0 });
  });
  return result;
}

export async function forecast(latitude: number, longitude: number, timezone: string): Promise<Map<string, Weather>> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "temperature_2m_max,precipitation_probability_max");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("forecast_days", "16");
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      // Forecasts change slowly; one fetch every few hours is plenty.
      next: { revalidate: 3 * 60 * 60 },
    });
    if (!response.ok) return new Map();
    return parseForecast((await response.json()) as OpenMeteoDaily);
  } catch {
    return new Map();
  }
}

export function weatherEmoji(weather: Weather | null | undefined): string | null {
  if (!weather) return null;
  if (weather.precipChance >= 60) return weather.tempMaxF < 34 ? "🌨️" : "🌧️";
  if (weather.tempMaxF < 35) return "🥶";
  if (weather.tempMaxF >= 85) return "☀️";
  return null;
}
