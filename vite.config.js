import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // REPLACE 'your-repo-name' WITH YOUR ACTUAL GITHUB REPOSITORY NAME
  base: '/your-repo-name/', 
  plugins: [
    react(),
    tailwindcss(),
  ],
})