import { PredictionModel } from '../src/Agent/PredictionModel';
import type { MarketData, ParsedQuestion } from '../src/types';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeMarketData(overrides: Partial<MarketData> = {}): MarketData {
  return {
    question: 'Will BTC > $100K?',
    symbol: 'BTC',
    coingeckoId: 'bitcoin',
    currentPrice: 95_000,
    targetValue: 100_000,
    price: {
      symbol: 'BTC',
      coingeckoId: 'bitcoin',
      currentPrice: 95_000,
      priceChange24h: 3.5,
      priceChange7d: 12.0,
      volume24h: 50_000_000_000,
      marketCap: 1_900_000_000_000,
    },
    trend: {
      direction: 'bullish',
      ma7: 90_000,
      ma30: 80_000,
      priceVsMa7: 5.6,
      priceVsMa30: 18.75,
      momentum: 0.12,
      historicalPrices: Array.from({ length: 30 }, (_, i) => 70_000 + i * 1_000),
    },
    sentiment: { score: 0.4, articleCount: 15, positiveCount: 9, negativeCount: 3, headlines: [] },
    fetchedAt: Date.now(),
    ...overrides,
  };
}

function makeParsed(overrides: Partial<ParsedQuestion> = {}): ParsedQuestion {
  return {
    symbol: 'BTC',
    coingeckoId: 'bitcoin',
    targetValue: 100_000,
    direction: 'above',
    timeframe: 'June',
    raw: 'Will BTC > $100K?',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PredictionModel', () => {
  describe('basic outcome', () => {
    it('returns YES when price is close to target and trend is bullish', () => {
      const model = new PredictionModel('balanced');
      const result = model.predict(makeMarketData(), makeParsed());
      expect(result.outcome).toBe('YES');
      expect(result.confidence).toBeGreaterThan(30);
    });

    it('returns NO when price is far below target and trend is bearish', () => {
      const model = new PredictionModel('balanced');
      const data = makeMarketData({
        currentPrice: 50_000,
        trend: {
          direction: 'bearish',
          ma7: 55_000,
          ma30: 70_000,
          priceVsMa7: -9,
          priceVsMa30: -28,
          momentum: -0.15,
          historicalPrices: Array.from({ length: 30 }, (_, i) => 80_000 - i * 1_000),
        },
        sentiment: { score: -0.6, articleCount: 10, positiveCount: 1, negativeCount: 8, headlines: [] },
      });
      const result = model.predict(data, makeParsed({ targetValue: 100_000 }));
      expect(result.outcome).toBe('NO');
      expect(result.confidence).toBeGreaterThan(10);
    });

    it('returns YES when price is already above target', () => {
      const model = new PredictionModel('technical');
      const data = makeMarketData({ currentPrice: 110_000 });
      const result = model.predict(data, makeParsed({ targetValue: 100_000, direction: 'above' }));
      expect(result.outcome).toBe('YES');
      // Composite ~68 → confidence (68-50)*2 = 36; check it's a meaningful non-zero value
      expect(result.confidence).toBeGreaterThan(25);
    });
  });

  describe('confidence range', () => {
    it('always returns confidence between 1 and 99', () => {
      const model = new PredictionModel('balanced');
      const result = model.predict(makeMarketData(), makeParsed());
      expect(result.confidence).toBeGreaterThanOrEqual(1);
      expect(result.confidence).toBeLessThanOrEqual(99);
    });
  });

  describe('agent type differentiation', () => {
    it('technical and sentiment agents can disagree on same data', () => {
      const tech = new PredictionModel('technical');
      const sent = new PredictionModel('sentiment');

      // Bullish price but bearish news
      const data = makeMarketData({
        trend: {
          direction: 'bullish',
          ma7: 92_000,
          ma30: 85_000,
          priceVsMa7: 3.3,
          priceVsMa30: 11.8,
          momentum: 0.08,
          historicalPrices: [],
        },
        sentiment: { score: -0.9, articleCount: 20, positiveCount: 1, negativeCount: 18, headlines: [] },
      });

      const techResult = tech.predict(data, makeParsed());
      const sentResult = sent.predict(data, makeParsed());

      // Tech should lean YES (bullish trend), sentiment should lean NO (bearish news)
      expect(techResult.outcome).toBe('YES');
      expect(sentResult.outcome).toBe('NO');
    });
  });

  describe('reasoning', () => {
    it('includes price and trend info in reasoning', () => {
      const model = new PredictionModel('balanced');
      const result = model.predict(makeMarketData(), makeParsed());
      expect(result.reasoning).toContain('$95,000');
      expect(result.reasoning).toContain('Prediction:');
      expect(result.reasoning).toContain('Technical Analysis');
    });
  });
});
