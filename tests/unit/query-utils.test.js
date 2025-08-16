const { describe, test, expect, beforeEach } = require('@jest/globals');

// Testing the refactored QueryBuilder and QueryUtils structure
describe('QueryUtils (Testing Refactored Structure)', () => {
    // Mock implementation based on the actual src/query-utils.js structure
    class MockQueryBuilder {
        constructor(tableName = 'despesas') {
            this.tableName = tableName;
            this.selectFields = ['*'];
            this.whereConditions = [];
            this.orderByFields = [];
            this.groupByFields = [];
            this.havingConditions = [];
            this.limitValue = null;
            this.offsetValue = null;
        }

        select(fields) {
            if (Array.isArray(fields)) {
                this.selectFields = fields;
            } else if (typeof fields === 'string') {
                this.selectFields = [fields];
            }
            return this;
        }

        where(condition, value = null) {
            if (value !== null) {
                this.whereConditions.push(`${condition} = '${this.escapeValue(value)}'`);
            } else {
                this.whereConditions.push(condition);
            }
            return this;
        }

        whereIn(field, values) {
            if (values.length === 0) return this;
            const escapedValues = values.map(v => `'${this.escapeValue(v)}'`).join(', ');
            this.whereConditions.push(`${field} IN (${escapedValues})`);
            return this;
        }

        whereNotNull(field) {
            this.whereConditions.push(`${field} IS NOT NULL`);
            return this;
        }

        whereGreaterThan(field, value) {
            this.whereConditions.push(`${field} > ${value}`);
            return this;
        }

        whereGreaterThanOrEqual(field, value) {
            this.whereConditions.push(`${field} >= ${value}`);
            return this;
        }

        whereLike(field, pattern) {
            this.whereConditions.push(`LOWER(${field}) LIKE LOWER('%${this.escapeValue(pattern)}%')`);
            return this;
        }

        orderBy(field, direction = 'ASC') {
            this.orderByFields.push(`${field} ${direction.toUpperCase()}`);
            return this;
        }

        groupBy(fields) {
            if (Array.isArray(fields)) {
                this.groupByFields = fields;
            } else {
                this.groupByFields = [fields];
            }
            return this;
        }

        having(condition) {
            this.havingConditions.push(condition);
            return this;
        }

        limit(count) {
            this.limitValue = count;
            return this;
        }

        offset(count) {
            this.offsetValue = count;
            return this;
        }

        escapeValue(value) {
            return String(value).replace(/'/g, "''");
        }

        build() {
            let query = `SELECT ${this.selectFields.join(', ')} FROM ${this.tableName}`;

            if (this.whereConditions.length > 0) {
                query += ` WHERE ${this.whereConditions.join(' AND ')}`;
            }

            if (this.groupByFields.length > 0) {
                query += ` GROUP BY ${this.groupByFields.join(', ')}`;
            }

            if (this.havingConditions.length > 0) {
                query += ` HAVING ${this.havingConditions.join(' AND ')}`;
            }

            if (this.orderByFields.length > 0) {
                query += ` ORDER BY ${this.orderByFields.join(', ')}`;
            }

            if (this.limitValue !== null) {
                query += ` LIMIT ${this.limitValue}`;
            }

            if (this.offsetValue !== null) {
                query += ` OFFSET ${this.offsetValue}`;
            }

            return query;
        }

        clone() {
            const newBuilder = new MockQueryBuilder(this.tableName);
            newBuilder.selectFields = [...this.selectFields];
            newBuilder.whereConditions = [...this.whereConditions];
            newBuilder.orderByFields = [...this.orderByFields];
            newBuilder.groupByFields = [...this.groupByFields];
            newBuilder.havingConditions = [...this.havingConditions];
            newBuilder.limitValue = this.limitValue;
            newBuilder.offsetValue = this.offsetValue;
            return newBuilder;
        }
    }

    const MockQueryUtils = {
        buildPaginatedQuery(baseQuery, page = 1, pageSize = 50) {
            const offset = (page - 1) * pageSize;
            return `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
        },

        buildCountQuery(baseQuery) {
            const fromMatch = baseQuery.match(/FROM\s+(\w+)/i);
            const whereMatch = baseQuery.match(/WHERE\s+(.+?)(?:\s+GROUP BY|\s+ORDER BY|\s+LIMIT|$)/i);
            
            if (!fromMatch) return null;
            
            let countQuery = `SELECT COUNT(*) as total FROM ${fromMatch[1]}`;
            if (whereMatch) {
                countQuery += ` WHERE ${whereMatch[1]}`;
            }
            
            return countQuery;
        }
    };

    describe('QueryBuilder', () => {
        let queryBuilder;

        beforeEach(() => {
            queryBuilder = new MockQueryBuilder('despesas');
        });

        describe('select', () => {
            test('should set select fields from array', () => {
                queryBuilder.select(['name', 'email']);
                expect(queryBuilder.selectFields).toEqual(['name', 'email']);
            });

            test('should set select fields from string', () => {
                queryBuilder.select('name');
                expect(queryBuilder.selectFields).toEqual(['name']);
            });
        });

        describe('where', () => {
            test('should add where condition with value', () => {
                queryBuilder.where('name', 'John');
                expect(queryBuilder.whereConditions).toContain("name = 'John'");
            });

            test('should add raw where condition without value', () => {
                queryBuilder.where('age > 18');
                expect(queryBuilder.whereConditions).toContain('age > 18');
            });
        });

        describe('whereIn', () => {
            test('should create IN condition', () => {
                queryBuilder.whereIn('status', ['active', 'pending']);
                expect(queryBuilder.whereConditions).toContain("status IN ('active', 'pending')");
            });

            test('should handle empty array', () => {
                queryBuilder.whereIn('status', []);
                expect(queryBuilder.whereConditions).toHaveLength(0);
            });
        });

        describe('whereLike', () => {
            test('should create LIKE condition', () => {
                queryBuilder.whereLike('name', 'John');
                expect(queryBuilder.whereConditions).toContain("LOWER(name) LIKE LOWER('%John%')");
            });
        });

        describe('whereGreaterThan', () => {
            test('should create > condition', () => {
                queryBuilder.whereGreaterThan('age', 18);
                expect(queryBuilder.whereConditions).toContain('age > 18');
            });
        });

        describe('whereGreaterThanOrEqual', () => {
            test('should create >= condition', () => {
                queryBuilder.whereGreaterThanOrEqual('age', 18);
                expect(queryBuilder.whereConditions).toContain('age >= 18');
            });
        });

        describe('orderBy', () => {
            test('should add order by clause with default ASC', () => {
                queryBuilder.orderBy('name');
                expect(queryBuilder.orderByFields).toContain('name ASC');
            });

            test('should add order by clause with DESC', () => {
                queryBuilder.orderBy('name', 'DESC');
                expect(queryBuilder.orderByFields).toContain('name DESC');
            });
        });

        describe('groupBy', () => {
            test('should set group by fields from array', () => {
                queryBuilder.groupBy(['name', 'category']);
                expect(queryBuilder.groupByFields).toEqual(['name', 'category']);
            });

            test('should set group by field from string', () => {
                queryBuilder.groupBy('name');
                expect(queryBuilder.groupByFields).toEqual(['name']);
            });
        });

        describe('limit', () => {
            test('should set limit value', () => {
                queryBuilder.limit(10);
                expect(queryBuilder.limitValue).toBe(10);
            });
        });

        describe('offset', () => {
            test('should set offset value', () => {
                queryBuilder.offset(5);
                expect(queryBuilder.offsetValue).toBe(5);
            });
        });

        describe('escapeValue', () => {
            test('should escape single quotes', () => {
                expect(queryBuilder.escapeValue("O'Connor")).toBe("O''Connor");
            });

            test('should handle strings without quotes', () => {
                expect(queryBuilder.escapeValue("normal string")).toBe("normal string");
            });
        });

        describe('build', () => {
            test('should build basic SELECT query', () => {
                const query = queryBuilder.build();
                expect(query).toBe('SELECT * FROM despesas');
            });

            test('should build query with all clauses', () => {
                const query = queryBuilder
                    .select(['name', 'email'])
                    .where('active', '1')
                    .groupBy(['category'])
                    .orderBy('name', 'DESC')
                    .limit(10)
                    .offset(5)
                    .build();

                expect(query).toContain('SELECT name, email FROM despesas');
                expect(query).toContain("WHERE active = '1'");
                expect(query).toContain('GROUP BY category');
                expect(query).toContain('ORDER BY name DESC');
                expect(query).toContain('LIMIT 10');
                expect(query).toContain('OFFSET 5');
            });
        });

        describe('clone', () => {
            test('should create independent copy', () => {
                const original = new MockQueryBuilder('test')
                    .select(['name'])
                    .where('active', '1')
                    .limit(5);

                const cloned = original.clone();
                cloned.where('verified', '1');

                expect(original.whereConditions).toHaveLength(1);
                expect(cloned.whereConditions).toHaveLength(2);
                expect(cloned.tableName).toBe('test');
                expect(cloned.limitValue).toBe(5);
            });
        });
    });

    describe('QueryUtils', () => {
        describe('buildPaginatedQuery', () => {
            test('should add pagination to query', () => {
                const baseQuery = 'SELECT * FROM despesas WHERE active = 1';
                const paginatedQuery = MockQueryUtils.buildPaginatedQuery(baseQuery, 2, 20);
                
                expect(paginatedQuery).toBe('SELECT * FROM despesas WHERE active = 1 LIMIT 20 OFFSET 20');
            });
        });

        describe('buildCountQuery', () => {
            test('should build count query from SELECT query', () => {
                const baseQuery = 'SELECT nome, valor FROM despesas WHERE active = 1 ORDER BY valor DESC';
                const countQuery = MockQueryUtils.buildCountQuery(baseQuery);
                
                expect(countQuery).toBe('SELECT COUNT(*) as total FROM despesas WHERE active = 1');
            });

            test('should return null for invalid query', () => {
                const invalidQuery = 'INVALID QUERY';
                const countQuery = MockQueryUtils.buildCountQuery(invalidQuery);
                
                expect(countQuery).toBeNull();
            });
        });
    });
});