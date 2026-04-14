export interface Statistics {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
}

export class DataUtils {
  static safeToNumber(value: number | bigint): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    return value;
  }

  static convertNumericFields(
    obj: Record<string, unknown>,
    fields: string[] = ['total_value', 'transaction_count', 'valor_liquido', 'valor_documento']
  ): Record<string, unknown> {
    const result = { ...obj };
    fields.forEach((field) => {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = this.safeToNumber(result[field] as number | bigint);
      }
    });
    return result;
  }

  static calculateStatistics(values: unknown[]): Statistics {
    const empty: Statistics = {
      count: 0,
      sum: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      standardDeviation: 0,
    };

    if (!Array.isArray(values) || !values.length) return empty;

    const numericValues = values.filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (!numericValues.length) return empty;

    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / numericValues.length;

    const sortedValues = [...numericValues].sort((a, b) => a - b);
    const median =
      sortedValues.length % 2 === 0
        ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
        : sortedValues[Math.floor(sortedValues.length / 2)];

    const variance =
      numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      count: numericValues.length,
      sum,
      mean,
      median,
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      standardDeviation,
    };
  }

  static groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(item);
        return groups;
      },
      {} as Record<string, T[]>
    );
  }

  static aggregateBy<T, V>(
    array: T[],
    keyFn: (item: T) => string,
    valueFn: (item: T) => V,
    aggregateFn: (values: V[]) => V = (values) =>
      values.reduce<V>((a, b) => ((a as number) + (b as number)) as unknown as V, 0 as unknown as V)
  ): Record<string, V> {
    const groups = this.groupBy(array, keyFn);
    const result: Record<string, V> = {};

    for (const [key, items] of Object.entries(groups)) {
      const values = items.map(valueFn);
      result[key] = aggregateFn(values);
    }

    return result;
  }

  static createSlug(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
