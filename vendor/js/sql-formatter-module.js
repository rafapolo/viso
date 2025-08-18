// Local SQL formatter module - exports the global sqlFormatter 
export const format = window.sqlFormatter?.format || (() => 'Formatter not loaded');