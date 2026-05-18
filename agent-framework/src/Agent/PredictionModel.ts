import type { MarketData, ParsedQuestion, PredictionResult, AgentType } from '../types';

/**
 * Weight profiles per agent type.
 * Values must sum to 1.0.
 */
const AGENT_WEIGHTS: Record<AgentType, { technical: number; sentiment: number; price: number }> = {
  technical: { technical: 0.65, sentiment: 0.10, price: 0.25 },
  sentiment: { technical: 0.25, sentiment: 0.55, price: 0.20 },
  balanced:  { technical: 0.40, sentiment: 0.30, price: 0.30 },
};

export class PredictionModel {
  constructor(private readonly agentType: AgentType = 'balanced') {}

  /**
   * Run prediction on assembled market data.
   * Returns outcome, confidence 0-100, and human-readable reasoning.
   */
  predict(data: MarketData, parsed: ParsedQuestion): PredictionResult {
    const weights = AGENT_WEIGHTS[this.agentType];

    const technicalScore = this._technicalScore(data);
    const sentimentScore = this._sentimentScore(data);
    const priceScore = this._priceProximityScore(data, parsed);

    // Weighted composite: 0–100
    const composite =
      technicalScore * weights.technical +
      sentimentScore * weights.sentiment +
      priceScore     * weights.price;

    // composite > 50 → YES, <= 50 → NO
    const outcome: 'YES' | 'NO' = composite > 50 ? 'YES' : 'NO';

    // Confidence = distance from 50, scaled to 0–100
    const rawConfidence = Math.abs(composite - 50) * 2;
    const confidence = Math.min(99, Math.max(1, Math.round(rawConfidence)));

    const reasoning = this._buildReasoning(
      data, parsed, outcome, composite,
      technicalScore, sentimentScore, priceScore, weights
    );

    return {
      outcome,
      confidence,
      reasoning,
      technicalScore: Math.round(technicalScore),
      sentimentScore: Math.round(sentimentScore),
      priceAnalysisScore: Math.round(priceScore),
    };
  }

  // ─── Signal Scorers (each returns 0–100) ──────────────────────────────────

  /**
   * Technical score based on MA crossover + momentum.
   * >50 → bullish signal; <50 → bearish.
   */
  private _technicalScore(data: MarketData): number {
    const { trend } = data;

    // MA crossover: ma7 vs ma30
    const maCrossScore = trend.ma7 > trend.ma30 ? 65 : 35;

    // Price vs 7-day MA (normalised to 0–100)
    // +10% above MA → 80, -10% below → 20, clamp to [0,100]
    const priceVsMaScore = Math.max(0, Math.min(100, 50 + trend.priceVsMa7 * 2));

    // Momentum: convert -1..1 → 0..100
    const momentumScore = (trend.momentum + 1) * 50;

    // 24h price change
    const change24hScore = Math.max(0, Math.min(100, 50 + data.price.priceChange24h * 2));

    return (maCrossScore + priceVsMaScore + momentumScore + change24hScore) / 4;
  }

  /**
   * Sentiment score: convert -1..1 → 0..100
   */
  private _sentimentScore(data: MarketData): number {
    // sentiment.score is -1 to 1
    return (data.sentiment.score + 1) * 50;
  }

  /**
   * Price proximity score — how close/far is current price from the target.
   * If question is "BTC > $100K" and price is $95K → close, lean YES if trend bullish.
   * If price is already $110K → strong YES.
   */
  private _priceProximityScore(data: MarketData, parsed: ParsedQuestion): number {
    if (!parsed.targetValue || !parsed.direction) {
      // No target in question — use pure trend signal
      return this._technicalScore(data);
    }

    const current = data.currentPrice;
    const target = parsed.targetValue;
    const ratio = current / target; // 1.0 = at target

    if (parsed.direction === 'above') {
      if (ratio >= 1.0) return 90;       // already above target → strong YES
      if (ratio >= 0.95) return 72;      // within 5% → likely YES
      if (ratio >= 0.85) return 58;      // within 15% → lean YES
      if (ratio >= 0.70) return 40;      // 15-30% away → lean NO
      return 20;                          // >30% away → strong NO
    } else {
      // direction === 'below'
      if (ratio <= 1.0) return 90;       // already below target → strong YES
      if (ratio <= 1.05) return 72;
      if (ratio <= 1.15) return 58;
      if (ratio <= 1.30) return 40;
      return 20;
    }
  }

  // ─── Reasoning Builder ────────────────────────────────────────────────────

  private _buildReasoning(
    data: MarketData,
    parsed: ParsedQuestion,
    outcome: 'YES' | 'NO',
    composite: number,
    techScore: number,
    sentScore: number,
    priceScore: number,
    weights: { technical: number; sentiment: number; price: number }
  ): string {
    const lines: string[] = [
      `Prediction: ${outcome} (composite score ${composite.toFixed(1)}/100)`,
      ``,
      `--- Technical Analysis (weight ${(weights.technical * 100).toFixed(0)}%) ---`,
      `  Current price: $${data.currentPrice.toLocaleString()}`,
      `  7-day MA: $${data.trend.ma7.toFixed(2)} | 30-day MA: $${data.trend.ma30.toFixed(2)}`,
      `  Price vs 7d MA: ${data.trend.priceVsMa7 > 0 ? '+' : ''}${data.trend.priceVsMa7.toFixed(2)}%`,
      `  Momentum: ${data.trend.momentum > 0 ? '+' : ''}${data.trend.momentum.toFixed(3)}`,
      `  Trend: ${data.trend.direction} | Technical score: ${techScore.toFixed(1)}`,
      ``,
      `--- Sentiment Analysis (weight ${(weights.sentiment * 100).toFixed(0)}%) ---`,
      `  Sentiment score: ${data.sentiment.score.toFixed(2)} (${data.sentiment.articleCount} articles)`,
      `  Positive signals: ${data.sentiment.positiveCount} | Negative: ${data.sentiment.negativeCount}`,
      `  Sentiment score: ${sentScore.toFixed(1)}`,
      ``,
      `--- Price Proximity (weight ${(weights.price * 100).toFixed(0)}%) ---`,
    ];

    if (parsed.targetValue && parsed.direction) {
      const pct = ((data.currentPrice / parsed.targetValue - 1) * 100).toFixed(1);
      lines.push(
        `  Target: $${parsed.targetValue.toLocaleString()} | Current: $${data.currentPrice.toLocaleString()}`,
        `  Distance from target: ${pct}% | Price score: ${priceScore.toFixed(1)}`
      );
    } else {
      lines.push(`  No explicit target — using trend signal: ${priceScore.toFixed(1)}`);
    }

    return lines.join('\n');
  }
}
