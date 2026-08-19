import { ExchangeRate, HistoricalRate } from '../types';
import { getDB, putToStore, saveHistoricalRatesToDB, getAllFromStore, getHistoricalRateFromDB } from '../db/indexeddb';

const PRIMARY_BCV_API = 'https://ve.dolarapi.com/v1/dolares/oficial';
const HISTORICAL_BCV_API = 'https://ve.dolarapi.com/v1/historicos/dolares/oficial';
const HISTORICAL_PARALELO_API = 'https://ve.dolarapi.com/v1/historicos/dolares/paralelo';
const FALLBACK_DEFAULT_RATE = 36.50;

export async function fetchCurrentBCVRate(): Promise<ExchangeRate> {
  const db = await getDB();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout

    const response = await fetch(PRIMARY_BCV_API, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const fetchedRate = Number(data.promedio || data.monto || data.price || FALLBACK_DEFAULT_RATE);

      const rateObj: ExchangeRate = {
        id: 'rate-' + Date.now(),
        rate_ves: fetchedRate,
        source_api: 'BCV Oficial (dolarapi.com)',
        fetched_at: new Date().toISOString(),
      };

      await putToStore('exchange_rates', rateObj);
      return rateObj;
    }
  } catch (error) {
    console.warn('Network error or API down when fetching BCV rate. Using stored or fallback rate.', error);
  }

  // Fallback to IndexedDB stored rate
  const rates = await db.getAll('exchange_rates');
  if (rates && rates.length > 0) {
    // Return latest rate sorted by fetched_at
    rates.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime());
    return rates[0];
  }

  // Absolute fallback
  const defaultRate: ExchangeRate = {
    id: 'rate-fallback',
    rate_ves: FALLBACK_DEFAULT_RATE,
    source_api: 'BCV Inicial (Fallback)',
    fetched_at: new Date().toISOString(),
  };
  await putToStore('exchange_rates', defaultRate);
  return defaultRate;
}

/**
 * Fetches full historical dollar rates from DolarApi and saves them into IndexedDB.
 */
export async function fetchHistoricalRatesFromAPI(): Promise<HistoricalRate[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const [bcvRes, paraleloRes] = await Promise.allSettled([
      fetch(HISTORICAL_BCV_API, { signal: controller.signal }),
      fetch(HISTORICAL_PARALELO_API, { signal: controller.signal }),
    ]);
    clearTimeout(timeoutId);

    const ratesMap: Record<string, HistoricalRate> = {};

    if (bcvRes.status === 'fulfilled' && bcvRes.value.ok) {
      const bcvData = await bcvRes.value.json();
      if (Array.isArray(bcvData)) {
        bcvData.forEach((item: any) => {
          const rawDate = item.fecha || item.date || item.created_at;
          if (!rawDate) return;
          const dateStr = new Date(rawDate).toISOString().split('T')[0];
          const val = Number(item.promedio || item.monto || item.precio || item.valor || 0);

          if (val > 0) {
            ratesMap[dateStr] = {
              date: dateStr,
              rate_bcv: val,
              source: 'BCV (ve.dolarapi.com)',
              fetched_at: new Date().toISOString(),
            };
          }
        });
      }
    }

    if (paraleloRes.status === 'fulfilled' && paraleloRes.value.ok) {
      const parData = await paraleloRes.value.json();
      if (Array.isArray(parData)) {
        parData.forEach((item: any) => {
          const rawDate = item.fecha || item.date || item.created_at;
          if (!rawDate) return;
          const dateStr = new Date(rawDate).toISOString().split('T')[0];
          const val = Number(item.promedio || item.monto || item.precio || item.valor || 0);

          if (val > 0) {
            if (ratesMap[dateStr]) {
              ratesMap[dateStr].rate_paralelo = val;
            } else {
              ratesMap[dateStr] = {
                date: dateStr,
                rate_bcv: val,
                rate_paralelo: val,
                source: 'Paralelo (ve.dolarapi.com)',
                fetched_at: new Date().toISOString(),
              };
            }
          }
        });
      }
    }

    const fetchedList = Object.values(ratesMap);
    if (fetchedList.length > 0) {
      await saveHistoricalRatesToDB(fetchedList);
      return fetchedList.sort((a, b) => b.date.localeCompare(a.date));
    }
  } catch (err) {
    console.warn('Network error fetching historical dollar rates from API. Reading stored local history.', err);
  }

  // Read local IndexedDB historical store fallback
  const localList = await getAllFromStore<HistoricalRate>('historical_rates');
  return localList.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Lookup historical rate for a specific date (YYYY-MM-DD)
 */
export async function getRateForDate(dateStr: string): Promise<HistoricalRate | null> {
  const local = await getHistoricalRateFromDB(dateStr);
  if (local) return local;

  // Try API lookup for specific date (YYYY/MM/DD format for DolarApi)
  try {
    const formattedDate = dateStr.replace(/-/g, '/');
    const res = await fetch(`https://ve.dolarapi.com/v1/historicos/dolares/oficial/${formattedDate}`);
    if (res.ok) {
      const data = await res.json();
      const val = Number(data.promedio || data.monto || data.precio || FALLBACK_DEFAULT_RATE);
      const rateObj: HistoricalRate = {
        date: dateStr,
        rate_bcv: val,
        source: 'DolarApi Fecha Específica',
        fetched_at: new Date().toISOString(),
      };
      await saveHistoricalRatesToDB([rateObj]);
      return rateObj;
    }
  } catch (err) {
    console.warn(`Could not fetch historical rate for ${dateStr} from API`, err);
  }

  return null;
}

/**
 * Calculates devaluation / variation percentage between an older historical rate and current rate
 */
export function calcDevaluation(oldRate: number, currentRate: number): {
  percentage: number;
  text: string;
  isHigher: boolean;
  diffVES: number;
} {
  if (!oldRate || oldRate <= 0) {
    return { percentage: 0, text: '0%', isHigher: false, diffVES: 0 };
  }

  const diffVES = currentRate - oldRate;
  const percentage = ((currentRate - oldRate) / oldRate) * 100;
  const isHigher = percentage >= 0;
  const text = `${isHigher ? '+' : ''}${percentage.toFixed(2)}%`;

  return { percentage, text, isHigher, diffVES };
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatVES(amountUSD: number, rateVES: number): string {
  const vesTotal = (amountUSD || 0) * (rateVES || FALLBACK_DEFAULT_RATE);
  return `Bs ${vesTotal.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function calcVESAmount(amountUSD: number, rateVES: number): number {
  return (amountUSD || 0) * (rateVES || FALLBACK_DEFAULT_RATE);
}

