/**
 * scripts/start-all.mjs
 * One-Click Launcher for PTA1 Logbook Insight (Local-First Desktop Mode)
 *
 * Sequence:
 * 1. Checks if SharePoint directory exists.
 * 2. Runs scripts/extract-logbooks.mjs to ensure 100% fresh data on launch.
 * 3. Launches Vite Development Server (http://localhost:5173).
 * 4. Launches Auto-Sync Watcher for SharePoint.
 * 5. Opens default browser (Chrome/Edge) to http://localhost:5173.
 */

import fs from 'fs';
import path from 'path';
import { spawn, execSync, fork } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_DIR = path.resolve(__dirname, '..');

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

function formatNow() {
  return new Date().toLocaleTimeString('th-TH', { hour12: false });
}

console.log(`\n============================================================`);
console.log(`🚀 [${formatNow()}] ยินดีต้อนรับสู่ PTA1 Logbook Insight & IPS Studio`);
console.log(`👨‍💻 กำลังเตรียมระบบสำหรับ Boardman PE1 (พี่ A)...`);
console.log(`============================================================\n`);

const targetDir = fs.existsSync(SHAREPOINT_LIVE_DIR)
  ? SHAREPOINT_LIVE_DIR
  : path.join(WORKSPACE_DIR, 'logbooks');

// Step 1: Initial extraction
console.log(`⚡ [1/3] กำลังสกัดข้อมูลล่าสุดจาก SharePoint...`);
try {
  execSync(`node scripts/extract-logbooks.mjs --dir "${targetDir}"`, {
    cwd: WORKSPACE_DIR,
    stdio: 'inherit'
  });
} catch (err) {
  console.warn(`⚠️ การสกัดข้อมูลเบื้องต้นพบข้อควรระวัง:`, err.message);
}

// Step 2: Spawn Vite dev server
console.log(`\n🌐 [2/3] กำลังเปิด Local Web Server (Vite)...`);
const viteProc = spawn('npx.cmd', ['vite'], {
  cwd: WORKSPACE_DIR,
  stdio: 'inherit',
  shell: true
});

// Step 3: Spawn SharePoint Auto-Watcher
console.log(`👁️ [3/3] กำลังเปิด Auto-Sync Watcher เฝ้าโฟลเดอร์ SharePoint...`);
const watcherProc = fork(path.join(WORKSPACE_DIR, 'scripts', 'watch-logbooks.mjs'), ['--dir', targetDir], {
  cwd: WORKSPACE_DIR,
  stdio: 'inherit'
});

// Step 4: Open Browser after short delay
setTimeout(() => {
  console.log(`\n✨ เปิดหน้าเว็บ http://localhost:5173/ บนเบราว์เซอร์เรียบร้อยค่ะ!`);
  try {
    execSync('start http://localhost:5173/', { shell: true });
  } catch {
    // Ignore browser open error
  }
}, 1500);

// Graceful exit on Ctrl+C
const cleanup = () => {
  console.log(`\n🛑 กำลังปิดระบบ PTA1 Logbook Insight... ขอบคุณค่ะพี่ A!`);
  try {
    viteProc.kill();
  } catch {}
  try {
    watcherProc.kill();
  } catch {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
