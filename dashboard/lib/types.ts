export type Outcome = 'YES' | 'NO';
export type AgentType = 'technical' | 'sentiment' | 'balanced';
export type MarketStatus = 'active' | 'resolved' | 'expired';

export interface AgentPrediction {
  agentId: string;
  agentType: AgentType;
  agentAddress: string;
  outcome: Outcome;
  confidence: number;
  stakeAmount: string;   // formatted USDC string
  txHash?: string;
  timestamp: number;
}

export interface Market {
  id: number;
  question: string;
  deadline: number;           // unix seconds
  resolved: boolean;
  outcome?: boolean;          // true = YES won
  totalYesStake: string;      // formatted USDC
  totalNoStake: string;
  predictionCount: number;
  agentPredictions: AgentPrediction[];
  createdAt?: number;
}

export interface AgentStats {
  agentId: string;
  agentType: AgentType;
  marketsAnalyzed: number;
  accuracy: number;           // 0–100
  totalStaked: string;        // USDC
  totalWon: string;
  winRate: number;            // 0–100
}

export interface UserBet {
  marketId: number;
  question: string;
  outcome: Outcome;
  amountUsdc: number;
  txHash: string;
  timestamp: number;
  settled: boolean;
  won?: boolean;
  payout?: number;
}

export interface DashboardStats {
  totalMarkets: number;
  totalVolume: string;
  totalAgentBets: number;
  avgAgentAccuracy: number;
}
