import { GET_PERSONA_BY_DOMAIN } from '../graphql';

describe('GraphQL Queries', () => {
  describe('GET_PERSONA_BY_DOMAIN', () => {
    test('should be a valid GraphQL query', () => {
      expect(GET_PERSONA_BY_DOMAIN).toBeDefined();
      expect(typeof GET_PERSONA_BY_DOMAIN).toBe('string');
    });

    test('should contain required query structure', () => {
      const query = GET_PERSONA_BY_DOMAIN.toString();

      expect(query).toContain('query GetPersonaByDomain');
      expect(query).toContain('$domain: String!');
      expect(query).toContain('$chainId: Int!');
      expect(query).toContain('personas');
    });

    test('should query for required fields', () => {
      const query = GET_PERSONA_BY_DOMAIN.toString();

      const requiredFields = [
        'id',
        'tokenId',
        'name',
        'symbol',
        'creator',
        'owner',
        'erc20Token',
        'pairToken',
        'chainId',
        'domain',
        'metadata',
      ];

      requiredFields.forEach(field => {
        expect(query).toContain(field);
      });
    });

    test('should query for metadata fields', () => {
      const query = GET_PERSONA_BY_DOMAIN.toString();

      expect(query).toContain('metadata');
      expect(query).toContain('key');
      expect(query).toContain('value');
    });

    test('should use correct where clause', () => {
      const query = GET_PERSONA_BY_DOMAIN.toString();

      expect(query).toContain('where');
      expect(query).toContain('domain_eq');
      expect(query).toContain('chainId_eq');
    });

    test('should limit to 1 result', () => {
      const query = GET_PERSONA_BY_DOMAIN.toString();

      expect(query).toContain('limit: 1');
    });
  });
});
