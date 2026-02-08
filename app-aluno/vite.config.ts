import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  return {
    envDir: '..',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/abacate': {
          target: 'https://api.abacatepay.com/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/abacate/, '')
        },

      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'process.env.BUILD_TIMESTAMP': JSON.stringify(new Date().toISOString())
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
