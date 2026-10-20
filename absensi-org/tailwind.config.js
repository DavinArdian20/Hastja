/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hastja: {
          bg: '#121212',     // Hitam pekat lingkaran logo
          card: '#1E1E1E',   // Kartu / Panel netral
          border: '#2C2C2C', // Garis pembatas
          gold: '#E2A053',   // Lingkaran Emas
          navy: '#2F4879',   // Lingkaran Navy
          maroon: '#8A3931', // Lingkaran Marun
        }
      }
    },
  },
  plugins: [],
}