import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core': ['three'],
          'three-examples': ['three/examples/jsm/controls/OrbitControls.js',
                            'three/examples/jsm/postprocessing/EffectComposer.js',
                            'three/examples/jsm/postprocessing/RenderPass.js',
                            'three/examples/jsm/shaders/CopyShader.js']
        }
      }
    },
    target: 'esnext'
  },
  server: {
    port: 5173,
    open: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  optimizeDeps: {
    include: ['three'],
    exclude: []
  },
  esbuild: {
    target: 'esnext',
    supported: {
      'top-level-await': true
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});