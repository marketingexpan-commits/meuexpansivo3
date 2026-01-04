/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./gestao/src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            animation: {
                'fade-in-up': 'fade-in-up 0.5s ease-out',
                'progress-shrink': 'progress-shrink 3s linear forwards',
            },
            keyframes: {
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'progress-shrink': {
                    '0%': { width: '100%' },
                    '100%': { width: '0%' },
                }
            }
        },
    },
    plugins: [],
}
