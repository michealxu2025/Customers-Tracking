import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    // 关键修改: 使用相对路径，确保在 Netlify/Cloudflare/Nginx 子目录下也能正常运行
    base: './', 
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.GAS_URL': JSON.stringify(env.GAS_URL),
      'process.env.IMGBB_KEY': JSON.stringify(env.IMGBB_KEY)
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false
    }
  }
})