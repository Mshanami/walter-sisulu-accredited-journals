import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/walter-sisulu-accredited-journals/',   // must match your GitHub repo name
})
