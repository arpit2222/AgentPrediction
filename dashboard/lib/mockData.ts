import type { Market, AgentStats, DashboardStats } from './types';

const NOW = Math.floor(Date.now() / 1000);

export const MOCK_MARKETS: Market[] = [
  {
    id: 1,
    question: 'Will Bitcoin exceed $100,000 by December 31, 2026?',
    deadline: NOW + 30 * 86400,
    resolved: false,
    totalYesStake: '2340.00',
    totalNoStake: '1260.00',
    predictionCount: 6,
    agentPredictions: [
      { agentId: 'agent-A', agentType: 'technical', agentAddress: '0xAgentA', outcome: 'YES', confidence: 78, stakeAmount: '390.00', timestamp: NOW - 600 },
      { agentId: 'agent-B', agentType: 'sentiment', agentAddress: '0xAgentB', outcome: 'YES', confidence: 74, stakeAmount: '370.00', timestamp: NOW - 580 },
      { agentId: 'agent-C', agentType: 'balanced',  agentAddress: '0xAgentC', outcome: 'YES', confidence: 82, stakeAmount: '410.00', timestamp: NOW - 560 },
    ],
    createdAt: NOW - 3600,
  },
  {
    id: 2,
    question: 'Will Ethereum flip Bitcoin in market cap by Q3 2026?',
    deadline: NOW + 45 * 86400,
    resolved: false,
    totalYesStake: '840.00',
    totalNoStake: '1960.00',
    predictionCount: 4,
    agentPredictions: [
      { agentId: 'agent-A', agentType: 'technical', agentAddress: '0xAgentA', outcome: 'NO', confidence: 71, stakeAmount: '355.00', timestamp: NOW - 1200 },
      { agentId: 'agent-B', agentType: 'sentiment', agentAddress: '0xAgentB', outcome: 'NO', confidence: 66, stakeAmount: '330.00', timestamp: NOW - 1180 },
      { agentId: 'agent-C', agentType: 'balanced',  agentAddress: '0xAgentC', outcome: 'NO', confidence: 73, stakeAmount: '365.00', timestamp: NOW - 1160 },
    ],
    createdAt: NOW - 7200,
  },
  {
    id: 3,
    question: 'Will Solana SOL reach $500 before the end of 2026?',
    deadline: NOW + 60 * 86400,
    resolved: false,
    totalYesStake: '1100.00',
    totalNoStake: '900.00',
    predictionCount: 5,
    agentPredictions: [
      { agentId: 'agent-A', agentType: 'technical', agentAddress: '0xAgentA', outcome: 'YES', confidence: 65, stakeAmount: '325.00', timestamp: NOW - 1800 },
      { agentId: 'agent-B', agentType: 'sentiment', agentAddress: '0xAgentB', outcome: 'NO',  confidence: 58, stakeAmount: '290.00', timestamp: NOW - 1780 },
      { agentId: 'agent-C', agentType: 'balanced',  agentAddress: '0xAgentC', outcome: 'YES', confidence: 61, stakeAmount: '305.00', timestamp: NOW - 1760 },
    ],
    createdAt: NOW - 10800,
  },
  {
    id: 4,
    question: 'Will DOGE reach $1.00 in 2026?',
    deadline: NOW - 86400,       // expired
    resolved: true,
    outcome: false,              // NO won
    totalYesStake: '780.00',
    totalNoStake: '1420.00',
    predictionCount: 8,
    agentPredictions: [
      { agentId: 'agent-A', agentType: 'technical', agentAddress: '0xAgentA', outcome: 'NO', confidence: 79, stakeAmount: '395.00', timestamp: NOW - 172800 },
      { agentId: 'agent-B', agentType: 'sentiment', agentAddress: '0xAgentB', outcome: 'NO', confidence: 72, stakeAmount: '360.00', timestamp: NOW - 172780 },
      { agentId: 'agent-C', agentType: 'balanced',  agentAddress: '0xAgentC', outcome: 'NO', confidence: 77, stakeAmount: '385.00', timestamp: NOW - 172760 },
    ],
    createdAt: NOW - 259200,
  },
];

export const MOCK_AGENT_STATS: AgentStats[] = [
  { agentId: 'agent-A', agentType: 'technical', marketsAnalyzed: 4, accuracy: 85.0, totalStaked: '1465.00', totalWon: '912.50', winRate: 75 },
  { agentId: 'agent-B', agentType: 'sentiment', marketsAnalyzed: 4, accuracy: 79.5, totalStaked: '1350.00', totalWon: '780.00', winRate: 68 },
  { agentId: 'agent-C', agentType: 'balanced',  marketsAnalyzed: 4, accuracy: 82.3, totalStaked: '1465.00', totalWon: '850.25', winRate: 72 },
];

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalMarkets: 4,
  totalVolume: '10600.00',
  totalAgentBets: 12,
  avgAgentAccuracy: 82.3,
};

// Accuracy trend for charts (last 10 markets)
export const MOCK_ACCURACY_TREND = Array.from({ length: 10 }, (_, i) => ({
  market: i + 1,
  'agent-A': Math.min(100, 70 + i * 2 + Math.random() * 5),
  'agent-B': Math.min(100, 65 + i * 1.5 + Math.random() * 6),
  'agent-C': Math.min(100, 68 + i * 1.8 + Math.random() * 5),
}));
