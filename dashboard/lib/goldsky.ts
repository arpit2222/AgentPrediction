'use client';

import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const GOLDSKY_URL = process.env.NEXT_PUBLIC_GOLDSKY_URL || '';

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      console.warn('[Goldsky GraphQL error]', err.message);
    }
  }
  if (networkError) {
    console.warn('[Goldsky network error]', networkError.message);
  }
});

const httpLink = new HttpLink({
  uri: GOLDSKY_URL || '/api/mock-graphql',  // fallback to local mock route
  credentials: 'same-origin',
});

export const goldskyClient = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          markets: { merge: false },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
    query: { fetchPolicy: 'network-only' },
  },
});

export const isGoldskyConfigured = (): boolean => Boolean(GOLDSKY_URL);
