import { gql } from '@apollo/client';

export const GET_ALL_MARKETS = gql`
  query GetAllMarkets {
    markets(first: 100, orderBy: createdAt, orderDirection: desc) {
      id
      question
      deadline
      resolved
      outcome
      totalYesStakes
      totalNoStakes
      predictionCount
      createdAt
    }
  }
`;

export const GET_MARKET_DETAIL = gql`
  query GetMarketDetail($id: ID!) {
    market(id: $id) {
      id
      question
      deadline
      resolved
      outcome
      totalYesStakes
      totalNoStakes
      predictionCount
      predictions(orderBy: timestamp, orderDirection: asc) {
        id
        predictor
        position
        amount
        timestamp
        settled
      }
      createdAt
    }
  }
`;

export const GET_AGENT_STATS = gql`
  query GetAgentStats {
    agentStats(orderBy: accuracy, orderDirection: desc) {
      id
      agentAddress
      totalPredictions
      correctPredictions
      totalStaked
      totalWon
    }
  }
`;

export const GET_SETTLEMENTS = gql`
  query GetSettlements($marketId: ID!) {
    settlements(where: { market: $marketId }) {
      id
      winner
      payout
      timestamp
    }
  }
`;
