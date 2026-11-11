import { app } from './backend/app.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    // Development mode: Mount Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static files
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      const express = (await import('express')).default;
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.warn('Production dist directory not found. Please run "npm run build".');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Node.js Backend] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[MongoDB Engine] Active with collections: projects, certs, edu, exp, skills, messages`);
    console.log(`[API Docs] http://0.0.0.0:${PORT}/api`);
  });
}

startServer().catch((err) => {
  console.error('[Node.js Backend] Startup error:', err);
  process.exit(1);
});
