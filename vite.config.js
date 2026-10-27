import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = process.env.API_PORT || env.API_PORT || env.PORT || '4001';
  const apiTarget = `http://localhost:${apiPort}`;
  return {
    plugins: [react()],
    server: { proxy: { '/api': apiTarget, '/uploads': apiTarget } }
  };
});
