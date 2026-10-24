import { defineConfig } from 'vite';
import { fork } from 'child_process';
import path from 'path';
import fs from 'fs';

const userProfile = process.env.USERPROFILE || 'C:\\Users\\26007294';
const SHAREPOINT_LIVE_DIR = path.join(
  userProfile,
  'OneDrive - PTT Global Chemical Public Company Limited',
  'Shortcuts',
  'Production - PE Documents',
  '02 - Plant 1',
  'Log book PTA1',
  'Report FM,BM 2026'
);

function liveSyncPlugin() {
  let isRunning = false;

  const handleSyncRequest = async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    if (isRunning) {
      res.statusCode = 409;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'กำลังดำเนินการซิงค์ข้อมูลอยู่ กรุณารอสักครู่นะคะ' }));
      return;
    }

    isRunning = true;
    res.setHeader('Content-Type', 'application/json');

    const targetDir = fs.existsSync(SHAREPOINT_LIVE_DIR)
      ? SHAREPOINT_LIVE_DIR
      : path.resolve('logbooks');

    const extractScript = path.resolve('scripts/extract-logbooks.mjs');
    const child = fork(extractScript, ['--dir', targetDir], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      isRunning = false;
      if (code === 0) {
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, timestamp: new Date().toISOString() }));
      } else {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Extraction exited with code ${code}` }));
      }
    });

    child.on('error', (err) => {
      isRunning = false;
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    });
  };

  return {
    name: 'live-sync-plugin',
    configureServer(server) {
      server.middlewares.use('/api/sync-live', handleSyncRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/sync-live', handleSyncRequest);
    }
  };
}

export default defineConfig({
  plugins: [liveSyncPlugin()],
  server: {
    watch: {
      ignored: ['**/dist/**', '**/logbooks/**', '**/scratch/**', '**/public/data/**']
    }
  }
});
