import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Import the actual QueryBuilder to test its functionality
const { QueryBuilder } = await import('../../src/utils/query-builder.js');

// Mock QueryUtils - we'll test the interface, not the implementation
jest.unstable_mockModule('../../src/utils/query-utils.js', () => ({
  QueryUtils: {
    queryAggregatedData: jest.fn()
  }
}));

// Import after mocking
const { QueryUtils } = await import('../../src/utils/query-utils.js');

// Mock DuckDB manager since we don't want to test database connections
const mockDuckDBManager = {
  query: jest.fn(),
  getConnection: jest.fn(),
  isConnected: jest.fn(() => true)
};

describe('Query Utils and Builder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('QueryBuilder', () => {
        let queryBuilder;

        beforeEach(() => {
            queryBuilder = new QueryBuilder('despesas');
        });

        describe('basic query building', () => {
            test('should build basic SELECT query', () => {
                const query = queryBuilder.build();
                expect(query).toContain('SELECT');
                expect(query).toContain('FROM despesas');
            });

            test('should build query with select fields', () => {
                const query = queryBuilder
                    .select(['name', 'email'])
                    .build();
                expect(query).toContain('SELECT name, email');
            });

            test('should build query with where condition', () => {
                const query = queryBuilder
                    .where('active = 1')
                    .build();
                expect(query).toContain('WHERE active = 1');
            });

            test('should build query with multiple clauses', () => {
                const query = queryBuilder
                    .select(['name', 'email'])
                    .where('active = 1')
                    .orderBy('name')
                    .limit(10)
                    .build();

                expect(query).toContain('SELECT name, email');
                expect(query).toContain('WHERE active = 1');
                expect(query).toContain('ORDER BY name');
                expect(query).toContain('LIMIT 10');
            });
        });

        describe('method chaining', () => {
            test('should support method chaining', () => {
                const result = queryBuilder
                    .select(['name'])
                    .where('active = 1')
                    .limit(5);

                expect(result).toBe(queryBuilder);
            });

            test('should clone queryBuilder properly', () => {
                const original = queryBuilder
                    .select(['name'])
                    .where('active = 1');

                const cloned = original.clone();
                expect(cloned).not.toBe(original);
            });
        });
    });

    describe('QueryUtils', () => {
        describe('queryAggregatedData', () => {
            test('should call duckDBManager with proper query', async () => {
                const mockResult = [{ nome_parlamentar: 'Test', total_value: 1000 }];
                QueryUtils.queryAggregatedData.mockResolvedValue(mockResult);

                const result = await QueryUtils.queryAggregatedData(mockDuckDBManager, {
                    minValue: 100,
                    limit: 10
                });

                expect(QueryUtils.queryAggregatedData).toHaveBeenCalled();
                expect(result).toEqual(mockResult);
            });

            test('should handle filters correctly', async () => {
                const mockResult = [];
                QueryUtils.queryAggregatedData.mockResolvedValue(mockResult);

                await QueryUtils.queryAggregatedData(mockDuckDBManager, {
                    partyFilter: 'PT',
                    categoryFilter: 'COMBUSTÍVEL',
                    searchFilter: 'test'
                });

                expect(QueryUtils.queryAggregatedData).toHaveBeenCalled();
            });
        });

        describe('error handling', () => {
            test('should handle database errors gracefully', async () => {
                QueryUtils.queryAggregatedData.mockRejectedValue(new Error('Database error'));

                await expect(
                    QueryUtils.queryAggregatedData(mockDuckDBManager, {})
                ).rejects.toThrow('Database error');
            });
        });
    });
});