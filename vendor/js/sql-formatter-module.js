// Local SQL formatter module - exports the global sqlFormatter 
export const format = window.sqlFormatter?.format || ((sql) => {
    console.warn('SQL Formatter not loaded, returning unformatted SQL');
    return sql; // Return the original SQL instead of error message
});