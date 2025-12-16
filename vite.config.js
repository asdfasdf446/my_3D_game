import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  publicDir: 'assets', // 静态资源目录
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    outDir: 'dist'
  }
});
