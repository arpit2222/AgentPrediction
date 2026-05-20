import axios, { AxiosInstance } from 'axios';
import type {
  CryptoPrice,
  HistoricalPricePoint,
  TrendAnalysis,
  SentimentData,
  ParsedQuestion,
} from '../types';

// ─── Symbol → CoinGecko ID map ────────────────────────────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  LTC: 'litecoin',
  NEAR: 'near',
  APT: 'aptos',
  SUI: 'sui',
  OP: 'optimism',
  ARB: 'arbitrum',
};

// ─── Sentiment keyword dictionaries ───────────────────────────────────────────
const BULLISH_WORDS = [
  'surge', 'rally', 'bull', 'breakout', 'ath', 'all-time high', 'moon',
  'soar', 'gain', 'rise', 'climb', 'upside', 'record', 'adoption', 'growth',
  'bullish', 'positive', 'buy', 'buying', 'outperform', 'strong', 'pump',
];
const BEARISH_WORDS = [
  'crash', 'dump', 'bear', 'drop', 'fall', 'decline', 'sell-off', 'plunge',
  'fear', 'uncertainty', 'regulation', 'ban', 'hack', 'bearish', 'negative',
  'sell', 'selling', 'underperform', 'weak', 'correction', 'loss',
];

// Shared cache across all DataFetcher instances so 3 parallel agents don't each hit the API
const _fetchCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 90_000; // 90 seconds

function _cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = _fetchCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return Promise.resolve(hit.data as T);
  return fn().then((data) => { _fetchCache.set(key, { data, ts: Date.now() }); return data; });
}

export class DataFetcher {
  private cgClient: AxiosInstance;
  private newsClient: AxiosInstance;
  private newsApiKey: string;

  constructor(newsApiKey?: string) {
    this.newsApiKey = newsApiKey || process.env.NEWSAPI_KEY || '';

    this.cgClient = axios.create({
      baseURL: 'https://api.coingecko.com/api/v3',
      timeout: 15_000,
      headers: process.env.COINGECKO_API_KEY
        ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
        : {},
    });

    this.newsClient = axios.create({
      baseURL: 'https://newsapi.org/v2',
      timeout: 10_000,
    });
  }

  // ── Question Parser ────────────────────────────────────────────────────────

  parseQuestion(question: string): ParsedQuestion {
    const q = question.toUpperCase();

    // Detect symbol — match first symbol that appears as a whole word
    let symbol = 'BTC';
    let coingeckoId = 'bitcoin';
    let firstMatchIndex = Infinity;
    for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
      const match = q.match(new RegExp(`\\b${sym}\\b`));
      if (match && match.index !== undefined && match.index < firstMatchIndex) {
        firstMatchIndex = match.index;
        symbol = sym;
        coingeckoId = id;
      }
    }

    // Extract target value — e.g. "$100K", "$100,000", "100000"
    let targetValue: number | undefined;
    const targetMatch = question.match(/\$?([\d,]+\.?\d*)\s*([kKmMbB]?)/);
    if (targetMatch) {
      let val = parseFloat(targetMatch[1].replace(/,/g, ''));
      const suffix = targetMatch[2].toLowerCase();
      if (suffix === 'k') val *= 1_000;
      else if (suffix === 'm') val *= 1_000_000;
      else if (suffix === 'b') val *= 1_000_000_000;
      targetValue = val;
    }

    // Direction — "above", "over", ">", "below", "under", "<"
    let direction: 'above' | 'below' | undefined;
    if (/>|above|over|exceed|surpass/i.test(question)) direction = 'above';
    else if (/<|below|under|drop/i.test(question)) direction = 'below';

    // Timeframe
    const tfMatch = question.match(/by\s+(\w+\s*\d*)/i);
    const timeframe = tfMatch ? tfMatch[1] : undefined;

    return { symbol, coingeckoId, targetValue, direction, timeframe, raw: question };
  }

  // ── Crypto Price ───────────────────────────────────────────────────────────

  async getCryptoPrice(coingeckoId: string): Promise<CryptoPrice> {
    const symbol = this._idToSymbol(coingeckoId);
    const { data } = await this.cgClient.get('/simple/price', {
      params: {
        ids: coingeckoId,
        vs_currencies: 'usd',
        include_24hr_change: true,
        include_market_cap: true,
        include_24hr_vol: true,
        include_7d_change: true,
      },
    });

    const coin = data[coingeckoId];
    return {
      symbol,
      coingeckoId,
      currentPrice: coin.usd,
      priceChange24h: coin.usd_24h_change ?? 0,
      priceChange7d: coin.usd_7d_change ?? 0,
      volume24h: coin.usd_24h_vol ?? 0,
      marketCap: coin.usd_market_cap ?? 0,
    };
  }

  // ── Historical Data ────────────────────────────────────────────────────────

  async getHistoricalData(
    coingeckoId: string,
    days: number = 30
  ): Promise<HistoricalPricePoint[]> {
    const { data } = await this.cgClient.get(`/coins/${coingeckoId}/market_chart`, {
      params: { vs_currency: 'usd', days, interval: days > 90 ? 'daily' : 'daily' },
    });

    return (data.prices as [number, number][]).map(([ts, price]) => ({
      timestamp: ts,
      price,
    }));
  }

  // ── Trend Analysis ────────────────────────────────────────────────────────

  async getCryptoTrend(coingeckoId: string, days: number = 30): Promise<TrendAnalysis> {
    const history = await this.getHistoricalData(coingeckoId, days);
    const prices = history.map((p) => p.price);
    const current = prices[prices.length - 1];

    const ma7 = this._sma(prices, 7);
    const ma30 = this._sma(prices, 30);

    const priceVsMa7 = ((current - ma7) / ma7) * 100;
    const priceVsMa30 = ((current - ma30) / ma30) * 100;

    // Momentum: % change over last 7 data points
    const lookback = Math.min(7, prices.length - 1);
    const momentum = ((current - prices[prices.length - 1 - lookback]) /
      prices[prices.length - 1 - lookback]);

    const direction: TrendAnalysis['direction'] =
      priceVsMa7 > 3 && momentum > 0
        ? 'bullish'
        : priceVsMa7 < -3 && momentum < 0
        ? 'bearish'
        : 'neutral';

    return {
      direction,
      ma7,
      ma30,
      priceVsMa7,
      priceVsMa30,
      momentum: Math.max(-1, Math.min(1, momentum)),
      historicalPrices: prices,
    };
  }

  // ── Sentiment ─────────────────────────────────────────────────────────────

  async getMarketSentiment(keyword: string): Promise<SentimentData> {
    if (!this.newsApiKey) {
      return this._fallbackSentiment(keyword);
    }

    try {
      const { data } = await this.newsClient.get('/everything', {
        params: {
          q: keyword,
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: 20,
          apiKey: this.newsApiKey,
        },
      });

      const articles: Array<{ title: string; description?: string }> = data.articles ?? [];
      const headlines = articles.map((a) => a.title ?? '');

      let positive = 0;
      let negative = 0;

      for (const headline of headlines) {
        const lower = headline.toLowerCase();
        const posHits = BULLISH_WORDS.filter((w) => lower.includes(w)).length;
        const negHits = BEARISH_WORDS.filter((w) => lower.includes(w)).length;
        positive += posHits;
        negative += negHits;
      }

      const total = positive + negative || 1;
      const score = (positive - negative) / total; // -1 to 1

      return {
        score: Math.max(-1, Math.min(1, score)),
        articleCount: articles.length,
        positiveCount: positive,
        negativeCount: negative,
        headlines: headlines.slice(0, 5),
      };
    } catch {
      return this._fallbackSentiment(keyword);
    }
  }

  // ── Full Fetch ─────────────────────────────────────────────────────────────

  async fetchAllData(parsed: ParsedQuestion) {
    const key = `fetchAll:${parsed.coingeckoId}`;
    return _cached(key, async () => {
      const [priceResult, trendResult, sentimentResult] = await Promise.allSettled([
        this.getCryptoPrice(parsed.coingeckoId),
        this.getCryptoTrend(parsed.coingeckoId, 30),
        this.getMarketSentiment(parsed.symbol + ' cryptocurrency'),
      ]);

      const price = priceResult.status === 'fulfilled' ? priceResult.value : this._fallbackPrice(parsed);
      const trend = trendResult.status === 'fulfilled' ? trendResult.value : this._fallbackTrend();
      const sentiment = sentimentResult.status === 'fulfilled' ? sentimentResult.value : this._fallbackSentiment(parsed.symbol);

      if (priceResult.status === 'rejected') console.warn('[DataFetcher] price fetch failed, using fallback:', priceResult.reason?.message);
      if (trendResult.status === 'rejected') console.warn('[DataFetcher] trend fetch failed, using fallback');

      return { price, trend, sentiment };
    });
  }

  private _fallbackPrice(parsed: ParsedQuestion): CryptoPrice {
    return {
      symbol: parsed.symbol,
      coingeckoId: parsed.coingeckoId,
      currentPrice: parsed.targetValue ? parsed.targetValue * 0.8 : 50000,
      priceChange24h: 0, priceChange7d: 0, volume24h: 0, marketCap: 0,
    };
  }

  private _fallbackTrend(): TrendAnalysis {
    return {
      direction: 'neutral' as const,
      ma7: 0, ma30: 0, priceVsMa7: 0, priceVsMa30: 0,
      momentum: 0, historicalPrices: [],
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _sma(prices: number[], period: number): number {
    const window = prices.slice(-period);
    return window.reduce((a, b) => a + b, 0) / window.length;
  }

  private _idToSymbol(id: string): string {
    return Object.entries(COINGECKO_IDS).find(([, v]) => v === id)?.[0] ?? id.toUpperCase();
  }

  private _fallbackSentiment(keyword: string): SentimentData {
    // Neutral fallback when NewsAPI is unavailable
    return {
      score: 0,
      articleCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      headlines: [`[No NewsAPI key — sentiment neutral for ${keyword}]`],
    };
  }

  coingeckoIdForSymbol(symbol: string): string {
    return COINGECKO_IDS[symbol.toUpperCase()] ?? 'bitcoin';
  }
}
