/**
 * scripts/auto-deploy-shift.mjs
 * Automated Shift Handover Sync & Cloudflare Deployer
 *
 * Designed to be called by Windows Task Scheduler (e.g. 07:20 and 19:20 daily)
 * or executed manually before shift changeover.
 *
 * Sequence:
 * 1. Checks if SharePoint directory exists.
 * 2. Runs scripts/extract-logbooks.mjs with live directory.
 * 3. Builds production web bundle (vite build).
 * 4. Deploys updated bundle to Cloudflare Workers (npx wrangler deploy).
 */

import fs from 'fs';
import path from 'path';
import { execSync, fork } from 'child_process';
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
  return new Date().toLocaleString('th-TH', { hour12: false });
}

console.log(`\n============================================================`);
console.log(`🔄 [${formatNow()}] เริ่มต้นระบบ Auto-Sync รอบส่งเวร PTA1...`);
console.log(`============================================================`);

const targetDir = fs.existsSync(SHAREPOINT_LIVE_DIR)
  ? SHAREPOINT_LIVE_DIR
  : path.join(WORKSPACE_DIR, 'logbooks');

console.log(`📁 โฟลเดอร์เป้าหมาย: ${targetDir}`);

// Step 1: Extraction
console.log(`\n▶️ [1/3] กำลังสกัดข้อมูลจากไฟล์ Logbook ล่าสุด...`);
try {
  execSync(`node scripts/extract-logbooks.mjs --dir "${targetDir}"`, {
    cwd: WORKSPACE_DIR,
    stdio: 'inherit'
  });
  console.log(`✅ [1/3] สกัดข้อมูลลง public/data/ สำเร็จ`);
} catch (err) {
  console.error(`❌ [1/3] สกัดข้อมูลล้มเหลว:`, err.message);
  process.exit(1);
}

// Step 2: Build
console.log(`\n▶️ [2/3] กำลัง Build Production Assets (Vite)...`);
try {
  execSync(`npm run build`, {
    cwd: WORKSPACE_DIR,
    stdio: 'inherit'
  });
  console.log(`✅ [2/3] Build Production Bundle สำเร็จ`);
} catch (err) {
  console.error(`❌ [2/3] Build ล้มเหลว:`, err.message);
  process.exit(1);
}

// Step 3: Deploy to Cloudflare Workers
console.log(`\n▶️ [3/3] กำลัง Deploy ขึ้น Cloudflare Workers...`);
try {
  execSync(`npx wrangler deploy`, {
    cwd: WORKSPACE_DIR,
    stdio: 'inherit'
  });
  console.log(`\n🎉 [3/3] Deploy ขึ้น Cloudflare สำเร็จสมบูรณ์เรียบร้อยแล้วค่ะ!`);
  console.log(`🌐 Live URL: https://pta1-logbook-insight.supasiao.workers.dev`);
} catch (err) {
  console.error(`❌ [3/3] Deploy ขึ้น Cloudflare ล้มเหลว:`, err.message);
  process.exit(1);
}

console.log(`\n============================================================`);
console.log(`✨ [${formatNow()}] ภารกิจ Auto-Sync รอบส่งเวรเสร็จสิ้นสมบูรณ์! ขอบคุณค่ะพี่ A`);
console.log(`============================================================\n`);
