import type { ForecastDay, WeatherImpact } from '@/lib/types';

const WEATHER_CODE_MAP: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
};

const EXTERIOR_TRADES = new Set([
  'concrete',
  'fences_gates',
  'glass_glazing',
  'painting',
  'roofing',
  'site_work',
  'steel',
]);

interface GeocodingResponse {
  results?: Array<{
    latitude: number;
    longitude: number;
    name: string;
    admin1?: string;
    country_code?: string;
  }>;
}

interface ForecastResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
}

export async function getWeatherImpact(locationQuery: string, trade: string | null | undefined): Promise<WeatherImpact | null> {
  if (!locationQuery.trim()) {
    return null;
  }

  try {
    const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geoUrl.searchParams.set('name', locationQuery);
    geoUrl.searchParams.set('count', '1');
    geoUrl.searchParams.set('language', 'en');
    geoUrl.searchParams.set('format', 'json');

    const geoResponse = await fetch(geoUrl, { cache: 'no-store' });
    if (!geoResponse.ok) {
      return null;
    }

    const geocoding = (await geoResponse.json()) as GeocodingResponse;
    const match = geocoding.results?.[0];

    if (!match) {
      return null;
    }

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.searchParams.set('latitude', String(match.latitude));
    forecastUrl.searchParams.set('longitude', String(match.longitude));
    forecastUrl.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code'
    );
    forecastUrl.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max'
    );
    forecastUrl.searchParams.set('forecast_days', '5');
    forecastUrl.searchParams.set('temperature_unit', 'fahrenheit');
    forecastUrl.searchParams.set('wind_speed_unit', 'mph');
    forecastUrl.searchParams.set('precipitation_unit', 'inch');
    forecastUrl.searchParams.set('timezone', 'auto');

    const forecastResponse = await fetch(forecastUrl, { cache: 'no-store' });
    if (!forecastResponse.ok) {
      return null;
    }

    const forecast = (await forecastResponse.json()) as ForecastResponse;
    const humidity = forecast.current?.relative_humidity_2m ?? 0;
    const forecastDays = buildForecastDays(forecast, humidity);

    if (!forecastDays.length) {
      return null;
    }

    const { impactSummary, workImpact, logisticsImpact } = summarizeImpact(
      forecastDays,
      trade
    );

    return {
      location: buildLocationLabel(match),
      currentTemp: forecast.current?.temperature_2m,
      currentConditions: WEATHER_CODE_MAP[forecast.current?.weather_code ?? -1] ?? 'Unknown',
      forecastDays,
      impactSummary,
      workImpact,
      logisticsImpact,
    };
  } catch {
    return null;
  }
}

function buildForecastDays(forecast: ForecastResponse, humidity: number): ForecastDay[] {
  const dates = forecast.daily?.time ?? [];
  const codes = forecast.daily?.weather_code ?? [];
  const highs = forecast.daily?.temperature_2m_max ?? [];
  const lows = forecast.daily?.temperature_2m_min ?? [];
  const precipitation = forecast.daily?.precipitation_sum ?? [];
  const wind = forecast.daily?.wind_speed_10m_max ?? [];

  return dates.map((date, index) => ({
    date,
    high: highs[index] ?? 0,
    low: lows[index] ?? 0,
    conditions: WEATHER_CODE_MAP[codes[index] ?? -1] ?? 'Unknown',
    precipitation: precipitation[index] ?? 0,
    windSpeed: wind[index] ?? 0,
    humidity,
  }));
}

function summarizeImpact(forecastDays: ForecastDay[], trade: string | null | undefined) {
  const workImpact: string[] = [];
  const logisticsImpact: string[] = [];
  const tradeKey = trade?.trim().toLowerCase() ?? '';
  const isExteriorSensitive = EXTERIOR_TRADES.has(tradeKey);

  const wetDay = forecastDays.find((day) => day.precipitation >= 0.25);
  if (wetDay) {
    workImpact.push(
      `Rain is likely around ${wetDay.date}, which can slow outdoor work, deliveries, and site access.`
    );
    logisticsImpact.push('Sequence exterior scopes with rain buffers and protect staged materials.');
  }

  const windyDay = forecastDays.find((day) => day.windSpeed >= 20);
  if (windyDay) {
    const windNote = isExteriorSensitive
      ? 'High winds may directly impact installation safety and exterior productivity.'
      : 'High winds may still affect lift work, loading, and crew access.';
    workImpact.push(`${windNote} Peak wind is forecast near ${windyDay.date}.`);
    logisticsImpact.push('Confirm crane, lift, or ladder plans against wind limits before mobilization.');
  }

  const hotDay = forecastDays.find((day) => day.high >= 95);
  if (hotDay) {
    workImpact.push(`Heat exposure may reduce productivity and require additional crew breaks near ${hotDay.date}.`);
    logisticsImpact.push('Plan hydration, shade, and adjusted work windows for extreme afternoon heat.');
  }

  const coldDay = forecastDays.find((day) => day.low <= 35);
  if (coldDay) {
    workImpact.push(`Cold conditions can slow curing, finishing, and material handling near ${coldDay.date}.`);
    logisticsImpact.push('Check cold-weather handling requirements before committing installation sequencing.');
  }

  if (!workImpact.length) {
    workImpact.push('No immediate weather signal suggests a major productivity hit in the next few days.');
  }

  if (!logisticsImpact.length) {
    logisticsImpact.push('Weather outlook is stable enough for normal site planning with standard contingency buffers.');
  }

  const impactSummary =
    workImpact[0] ?? 'Weather impact is currently limited, but conditions should still be checked before mobilization.';

  return { impactSummary, workImpact, logisticsImpact };
}

function buildLocationLabel(match: NonNullable<GeocodingResponse['results']>[number]): string {
  return [match.name, match.admin1, match.country_code].filter(Boolean).join(', ');
}
