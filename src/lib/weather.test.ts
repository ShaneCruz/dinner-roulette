import { describe, expect, it } from "vitest";
import { parseForecast, weatherEmoji } from "./weather";

describe("weather", () => {
  it("parses Open-Meteo daily forecasts", () => {
    const parsed = parseForecast({
      daily: {
        time: ["2026-12-01", "2026-12-02"],
        temperature_2m_max: [28.4, 41],
        precipitation_probability_max: [20, null],
      },
    });
    expect(parsed.get("2026-12-01")).toEqual({ tempMaxF: 28.4, precipChance: 20 });
    expect(parsed.get("2026-12-02")).toEqual({ tempMaxF: 41, precipChance: 0 });
  });

  it("tolerates missing data", () => {
    expect(parseForecast({}).size).toBe(0);
  });

  it("picks an emoji only for weather worth mentioning", () => {
    expect(weatherEmoji({ tempMaxF: 30, precipChance: 10 })).toBe("🥶");
    expect(weatherEmoji({ tempMaxF: 60, precipChance: 80 })).toBe("🌧️");
    expect(weatherEmoji({ tempMaxF: 60, precipChance: 10 })).toBeNull();
  });
});
