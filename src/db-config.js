// Tailwind CSS configuration for db.html
/* global tailwind */
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'duckdb': {
                    50: '#fffbeb',
                    100: '#fef3c7',
                    200: '#fde68a',
                    300: '#fcd34d',
                    400: '#fbbf24', 
                    500: '#FFC000', // DuckDB yellow
                    600: '#d97706',
                    700: '#b45309',
                    800: '#92400e',
                    900: '#78350f'
                }
            },
            fontFamily: {
                'sans': ['Monda', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
            }
        }
    }
}