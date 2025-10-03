import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { configServerPlugin } from './vite-plugins/config-server';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    configServerPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@xenova/transformers/dist/ort-wasm-simd-threaded.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/@xenova/transformers/dist/ort-wasm-threaded.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/@xenova/transformers/dist/ort-wasm.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/@xenova/transformers/dist/ort-wasm-simd.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
          dest: 'assets',
        },
        {
          src: 'node_modules/@ricky0123/vad-web/dist/*.onnx',
          dest: 'assets',
        },
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/onnxruntime-web/dist/*.mjs',
          dest: 'assets',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: process.env.BASE_PATH || '/',
  define: {
    'import.meta.env.VITE_CONFIG_BUILD_ID': JSON.stringify(Date.now().toString()),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: ['sharp', 'onnxruntime-node'],
    },
  },
  server: {
    port: 3000,
  },
  optimizeDeps: {
    exclude: ['sharp', 'onnxruntime-node', 'onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
});
