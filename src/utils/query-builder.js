// ===== QUERY BUILDER =====
export class QueryBuilder {
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
        if (!values.length) return this;
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

        if (this.whereConditions.length) {
            query += ` WHERE ${this.whereConditions.join(' AND ')}`;
        }

        if (this.groupByFields.length) {
            query += ` GROUP BY ${this.groupByFields.join(', ')}`;
        }

        if (this.havingConditions.length) {
            query += ` HAVING ${this.havingConditions.join(' AND ')}`;
        }

        if (this.orderByFields.length) {
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
        const newBuilder = new QueryBuilder(this.tableName);
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