import { gql } from 'graphql-request';

export const GET_PERSONA_BY_DOMAIN = gql`
  query GetPersonaByDomain($domain: String!, $chainId: Int!) {
    personas(
      where: {
        domain_eq: $domain,
        chainId_eq: $chainId
      },
      limit: 1
    ) {
      id
      tokenId
      name
      symbol
      creator
      owner
      erc20Token
      pairToken
      agentToken
      pairCreated
      pairAddress
      createdAt
      createdAtBlock
      totalDeposited
      tokensSold
      graduationThreshold
      totalAgentDeposited
      minAgentTokens
      chainId
      domain
      metadata {
        key
        value
        updatedAt
      }
    }
  }
`;
