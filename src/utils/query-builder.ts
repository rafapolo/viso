// ===== QUERY BUILDER =====
export class QueryBuilder {
  tableName: string;
  selectFields: string[];
  whereConditions: string[];
  orderByFields: string[];
  groupByFields: string[];
  havingConditions: string[];
  limitValue: number | null;
  offsetValue: number | null;

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

  select(fields: string | string[]): this {
    if (Array.isArray(fields)) {
      this.selectFields = fields;
    } else if (typeof fields === 'string') {
      this.selectFields = [fields];
    }
    return this;
  }

  where(condition: string, value: string | number | null = null): this {
    if (value !== null) {
      this.whereConditions.push(`${condition} = '${this.escapeValue(value)}'`);
    } else {
      this.whereConditions.push(condition);
    }
    return this;
  }

  whereIn(field: string, values: (string | number)[]): this {
    if (!values.length) return this;
    const escapedValues = values.map((v) => `'${this.escapeValue(v)}'`).join(', ');
    this.whereConditions.push(`${field} IN (${escapedValues})`);
    return this;
  }

  whereNotNull(field: string): this {
    this.whereConditions.push(`${field} IS NOT NULL`);
    return this;
  }

  whereGreaterThan(field: string, value: string | number): this {
    this.whereConditions.push(`${field} > ${value}`);
    return this;
  }

  whereGreaterThanOrEqual(field: string, value: string | number): this {
    this.whereConditions.push(`${field} >= ${value}`);
    return this;
  }

  whereLike(field: string, pattern: string): this {
    this.whereConditions.push(
      `LOWER(${field}) LIKE LOWER('%${this.escapeValue(pattern)}%')`
    );
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByFields.push(`${field} ${direction.toUpperCase()}`);
    return this;
  }

  groupBy(fields: string | string[]): this {
    if (Array.isArray(fields)) {
      this.groupByFields = fields;
    } else {
      this.groupByFields = [fields];
    }
    return this;
  }

  having(condition: string): this {
    this.havingConditions.push(condition);
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  escapeValue(value: string | number | unknown): string {
    return String(value).replace(/'/g, "''");
  }

  build(): string {
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

  clone(): QueryBuilder {
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
