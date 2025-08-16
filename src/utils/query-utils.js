import { QueryBuilder } from './query-builder.js';

// ===== QUERY UTILITIES =====
export class QueryUtils {
    static async queryAggregatedData(duckDBManager, filters = {}) {
        const {
            minValue = 0,
            partyFilter = '',
            categoryFilter = '',
            searchFilter = '',
            limit = 1000
        } = filters;

        const query = new QueryBuilder('despesas')
            .select([
                'nome_parlamentar',
                'fornecedor',
                'categoria_despesa',
                'SUM(valor_liquido) as total_value',
                'COUNT(*) as transaction_count',
                'MIN(data_emissao) as first_transaction',
                'MAX(data_emissao) as last_transaction'
            ])
            .whereGreaterThanOrEqual('valor_liquido', minValue);

        if (partyFilter) {
            query.whereLike('nome_parlamentar', partyFilter);
        }

        if (categoryFilter) {
            query.whereLike('categoria_despesa', categoryFilter);
        }

        if (searchFilter) {
            query.where(`(LOWER(nome_parlamentar) LIKE LOWER('%${query.escapeValue(searchFilter)}%') 
                         OR LOWER(fornecedor) LIKE LOWER('%${query.escapeValue(searchFilter)}%'))`);
        }

        query.groupBy(['nome_parlamentar', 'fornecedor', 'categoria_despesa'])
            .orderBy('total_value', 'DESC')
            .limit(limit);

        const result = await duckDBManager.query(query.build());
        const data = result.toArray();
        
        return data.map(item => {
            const converted = {};
            Object.keys(item).forEach(key => {
                converted[key] = typeof item[key] === 'bigint' ? Number(item[key]) : item[key];
            });
            return converted;
        });
    }

    static async getValueRange(duckDBManager, filters = {}) {
        const {
            partyFilter = '',
            categoryFilter = '',
            searchFilter = ''
        } = filters;

        const query = new QueryBuilder('despesas')
            .select(['MIN(valor_liquido) as min_val', 'MAX(valor_liquido) as max_val']);

        if (partyFilter) {
            query.whereLike('nome_parlamentar', partyFilter);
        }

        if (categoryFilter) {
            query.whereLike('categoria_despesa', categoryFilter);
        }

        if (searchFilter) {
            query.where(`(LOWER(nome_parlamentar) LIKE LOWER('%${query.escapeValue(searchFilter)}%') 
                         OR LOWER(fornecedor) LIKE LOWER('%${query.escapeValue(searchFilter)}%'))`);
        }

        const result = await duckDBManager.query(query.build());
        const data = result.toArray()[0];
        return {
            min: data?.min_val || 0,
            max: data?.max_val || 0
        };
    }

    static async getFilterOptions(duckDBManager) {
        const [partiesResult, categoriesResult] = await Promise.all([
            duckDBManager.query(`
                SELECT nome_parlamentar, COUNT(*) as count
                FROM despesas 
                WHERE nome_parlamentar IS NOT NULL 
                GROUP BY nome_parlamentar 
                ORDER BY count DESC 
                LIMIT 100
            `),
            duckDBManager.query(`
                SELECT categoria_despesa, COUNT(*) as count
                FROM despesas 
                WHERE categoria_despesa IS NOT NULL 
                GROUP BY categoria_despesa 
                ORDER BY count DESC 
                LIMIT 50
            `)
        ]);

        return {
            parties: partiesResult.toArray(),
            categories: categoriesResult.toArray()
        };
    }

    static async getEntityDetails(duckDBManager, entityName, entityType) {
        let query;
        
        if (entityType === 'deputy') {
            query = new QueryBuilder('despesas')
                .select([
                    'data_emissao',
                    'categoria_despesa',
                    'fornecedor',
                    'valor_liquido',
                    'subcategoria_despesa'
                ])
                .where('nome_parlamentar', entityName)
                .orderBy('data_emissao', 'DESC')
                .limit(100);
        } else {
            query = new QueryBuilder('despesas')
                .select([
                    'data_emissao',
                    'categoria_despesa',
                    'nome_parlamentar',
                    'valor_liquido',
                    'subcategoria_despesa'
                ])
                .where('fornecedor', entityName)
                .orderBy('data_emissao', 'DESC')
                .limit(100);
        }

        const result = await duckDBManager.query(query.build());
        const rawTransactions = result.toArray();
        
        const transactions = rawTransactions.map(item => {
            const converted = {};
            Object.keys(item).forEach(key => {
                converted[key] = typeof item[key] === 'bigint' ? Number(item[key]) : item[key];
            });
            return converted;
        });

        const totalValue = transactions.reduce((sum, t) => sum + t.valor_liquido, 0);
        const totalTransactions = transactions.length;

        return {
            transactions,
            totalValue,
            totalTransactions,
            entityName,
            entityType
        };
    }

    static async getTimeSeriesData(duckDBManager, entityName, entityType, dateRange = {}) {
        const { startDate, endDate } = dateRange;
        
        const query = new QueryBuilder('despesas')
            .select([
                'DATE_TRUNC(\'month\', data_emissao) as month',
                'SUM(valor_liquido) as total_value',
                'COUNT(*) as transaction_count'
            ]);

        if (entityType === 'deputy') {
            query.where('nome_parlamentar', entityName);
        } else {
            query.where('fornecedor', entityName);
        }

        if (startDate) {
            query.whereGreaterThanOrEqual('data_emissao', `'${startDate}'`);
        }

        if (endDate) {
            query.whereGreaterThanOrEqual('data_emissao', `'${endDate}'`);
        }

        query.groupBy(['DATE_TRUNC(\'month\', data_emissao)'])
            .orderBy('month', 'ASC');

        const result = await duckDBManager.query(query.build());
        return result.toArray();
    }

    static async getCategoryBreakdown(duckDBManager, entityName, entityType) {
        const query = new QueryBuilder('despesas')
            .select([
                'categoria_despesa',
                'SUM(valor_liquido) as total_value',
                'COUNT(*) as transaction_count'
            ]);

        if (entityType === 'deputy') {
            query.where('nome_parlamentar', entityName);
        } else {
            query.where('fornecedor', entityName);
        }

        query.whereNotNull('categoria_despesa')
            .groupBy(['categoria_despesa'])
            .orderBy('total_value', 'DESC');

        const result = await duckDBManager.query(query.build());
        return result.toArray();
    }

    static async executeCustomQuery(duckDBManager, sql, params = {}) {
        let processedSQL = sql;
        
        Object.entries(params).forEach(([key, value]) => {
            const placeholder = new RegExp(`:${key}`, 'g');
            processedSQL = processedSQL.replace(placeholder, `'${String(value).replace(/'/g, "''")}'`);
        });

        try {
            const result = await duckDBManager.query(processedSQL);
            return {
                success: true,
                data: result.toArray(),
                columns: result.schema.fields.map(f => ({
                    name: f.name,
                    type: f.type.toString()
                })),
                query: processedSQL
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                query: processedSQL
            };
        }
    }

    static async getTableSchema(duckDBManager, tableName = 'despesas') {
        try {
            const result = await duckDBManager.query(`DESCRIBE ${tableName}`);
            return result.toArray().map(col => ({
                column_name: col.column_name,
                column_type: col.column_type,
                null: col.null === 'YES'
            }));
        } catch (error) {
            console.error('Error getting table schema:', error);
            return [];
        }
    }

    static buildPaginatedQuery(baseQuery, page = 1, pageSize = 50) {
        const offset = (page - 1) * pageSize;
        return `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
    }

    static buildCountQuery(baseQuery) {
        const fromMatch = baseQuery.match(/FROM\s+(\w+)/i);
        const whereMatch = baseQuery.match(/WHERE\s+(.+?)(?:\s+GROUP BY|\s+ORDER BY|\s+LIMIT|$)/i);
        
        if (!fromMatch) return null;
        
        let countQuery = `SELECT COUNT(*) as total FROM ${fromMatch[1]}`;
        if (whereMatch) {
            countQuery += ` WHERE ${whereMatch[1]}`;
        }
        
        return countQuery;
    }
}

export default QueryUtils;