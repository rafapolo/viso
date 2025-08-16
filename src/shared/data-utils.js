export class DataUtils {
    static safeToNumber(value) {
        if (typeof value === 'bigint') {
            return Number(value);
        }
        return value;
    }
    
    static convertNumericFields(obj, fields = ['total_value', 'transaction_count', 'valor_liquido', 'valor_documento']) {
        const result = { ...obj };
        fields.forEach(field => {
            if (result[field] !== undefined && result[field] !== null) {
                result[field] = this.safeToNumber(result[field]);
            }
        });
        return result;
    }

    static calculateStatistics(values) {
        if (!Array.isArray(values) || !values.length) {
            return {
                count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, standardDeviation: 0
            };
        }

        const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (!numericValues.length) {
            return {
                count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, standardDeviation: 0
            };
        }

        const sum = numericValues.reduce((acc, val) => acc + val, 0);
        const mean = sum / numericValues.length;
        
        const sortedValues = [...numericValues].sort((a, b) => a - b);
        const median = sortedValues.length % 2 === 0
            ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
            : sortedValues[Math.floor(sortedValues.length / 2)];

        const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;
        const standardDeviation = Math.sqrt(variance);

        return {
            count: numericValues.length,
            sum,
            mean,
            median,
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
            standardDeviation
        };
    }

    static groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }

    static aggregateBy(array, keyFn, valueFn, aggregateFn = (values) => values.reduce((a, b) => a + b, 0)) {
        const groups = this.groupBy(array, keyFn);
        const result = {};
        
        for (const [key, items] of Object.entries(groups)) {
            const values = items.map(valueFn);
            result[key] = aggregateFn(values);
        }
        
        return result;
    }

    static createSlug(text) {
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