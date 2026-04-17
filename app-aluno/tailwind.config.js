/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                'xs': '480px',
            },
            animation: {
                'fade-in-up': 'fade-in-up 0.5s ease-out',
                'progress-shrink': 'progress-shrink 3s linear forwards',
                'fade-in': 'fade-in 0.2s ease-out',
                'zoom-in': 'zoom-in 0.2s ease-out',
            },
            keyframes: {
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'progress-shrink': {
                    '0%': { width: '100%' },
                    '100%': { width: '0%' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'zoom-in': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                }
            }
        },
    },
    plugins: [],
}
