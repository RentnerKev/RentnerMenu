import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: { dedupe: ['react', 'react-dom', 'lucide-react'] },
    server: { host: '127.0.0.1', port: 4178, strictPort: true },
})
