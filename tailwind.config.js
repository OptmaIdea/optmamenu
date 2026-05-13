/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        // Adicione todos os caminhos que contêm classes do Tailwind
    ],
    // darkMode: 'class',
    theme: {
        extend: {
            // Personalizações de tema
        },
    },
    plugins: [],
}