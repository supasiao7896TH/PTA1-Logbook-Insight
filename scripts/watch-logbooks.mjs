/**
 * scripts/watch-logbooks.mjs
 * Auto-Sync & Real-Time File Watcher for SharePoint / OneDrive Logbooks
 * 
 * Functions:
 * 1. Monitors target directory (SharePoint synced folder or ./logbooks) for changes.
 * 2. Filters out temporary Excel lock files (~$*.xlsx), temp files, and non-Excel files.
 * 3. Debounces rapid-fire write events (8 seconds) while Boardmen are actively typing.
 * 4. Automatically triggers extraction pipeline and updates public/data/logbook_2026.json
 *    and lightweight public/data/logbook_meta.json for instant Web App live sync.
 */

import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { LogbookParser } from '../src/modules/logbook-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_DIR = path.resolve(__dirname, '..');

// Parse CLI arguments: --dir <path> or -d <path>
const args = process.argv.slice(2);
const dirArgIdx = args.findIndex((a) => a === '--dir' || a === '-d');
const customDir = dirArgIdx !== -1 && args[dirArgIdx + 1] ? path.resolve(args[dirArgIdx + 1]) : process.env.LOGBOOK_DIR;

const TARGET_DIR = customDir && fs.existsSync(customDir)
  ? customDir
  : fs.existsSync(path.join(WORKSPACE_DIR, 'logbooks'))
    ? path.join(WORKSPACE_DIR, 'logbooks')
    : WORKSPACE_DIR;

const META_JSON = path.join(WORKSPACE_DIR, 'public', 'data', 'logbook_meta.json');
const EXTRACT_SCRIPT = path.join(WORKSPACE_DIR, 'scripts', 'extract-logbooks.mjs');

const DEBOUNCE_MS = 8000; // 8 seconds debounce for Excel / OneDrive saves
let debounceTimer = null;
let pendingFiles = new Set();
let isExtracting = false;

function formatNow() {
  return new Date().toLocaleTimeString('th-TH', { hour12: false });
}

function updateMetaFile(lastChangedFile, generatedAt = new Date().toISOString()) {
  try {
    fs.mkdirSync(path.dirname(META_JSON), { recursive: true });
    const meta = {
      generatedAt,
      lastChangedFile: lastChangedFile || 'manual',
      syncMode: 'auto-watcher',
      targetDir: TARGET_DIR
    };
    fs.writeFileSync(META_JSON, JSON.stringify(meta, null, 2), 'utf8');
  } catch (err) {
    console.error(`[${formatNow()}] ⚠️ ไม่สามารถบันทึก logbook_meta.json:`, err.message);
  }
}

function triggerExtraction() {
  if (isExtracting) {
    console.log(`[${formatNow()}] ⏳ การสกัดข้อมูลเดิมยังรันอยู่ จะรอรอบถัดไปค่ะ`);
    return;
  }

  isExtracting = true;
  const filesList = Array.from(pendingFiles).join(', ');
  pendingFiles.clear();

  console.log(`\n============================================================`);
  console.log(`⚡ [${formatNow()}] ตรวจพบไฟล์ Logbook บันทึกเสร็จเรียบร้อย: ${filesList}`);
  console.log(`🚀 กำลังสกัดข้อมูลเข้า Web App อัตโนมัติ (scripts/extract-logbooks.mjs)...`);
  console.log(`============================================================\n`);

  const child = fork(EXTRACT_SCRIPT, ['--dir', TARGET_DIR], {
    cwd: WORKSPACE_DIR,
    stdio: 'inherit'
  });

  child.on('close', (code) => {
    isExtracting = false;
    if (code === 0) {
      const nowIso = new Date().toISOString();
      updateMetaFile(filesList, nowIso);
      console.log(`\n✨ [${formatNow()}] อัปเดตฐานข้อมูลสำเร็จเรียบร้อยค่ะ! (Web App พร้อมรับข้อมูลสดใหม่)`);
    } else {
      console.error(`\n❌ [${formatNow()}] การสกัดข้อมูลล้มเหลว (Exit code: ${code})`);
    }
  });

  child.on('error', (err) => {
    isExtracting = false;
    console.error(`\n❌ [${formatNow()}] สคริปต์เกิดข้อผิดพลาด:`, err.message);
  });
}

function onFileEvent(eventType, filename) {
  if (!filename) return;

  // Ignore temporary Excel files, temp files, hidden files
  if (LogbookParser.isIgnoredLogbookFile(filename)) return;

  // Only watch Excel files
  const lower = filename.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xlsm')) return;

  pendingFiles.add(filename);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  console.log(`[${formatNow()}] 📝 ตรวจพบการพิมพ์/แก้ไขไฟล์: "${filename}" (รอพิมพ์เสร็จ ${DEBOUNCE_MS / 1000} วิ...)`);

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    triggerExtraction();
  }, DEBOUNCE_MS);
}

function startWatching() {
  console.log(`\n============================================================`);
  console.log(`👁️  PTA1 Logbook Auto-Sync Watcher เริ่มทำงานแล้วค่ะ!`);
  console.log(`📂 โฟลเดอร์ที่เฝ้าตรวจจับ: ${TARGET_DIR}`);
  console.log(`⏱️  หน่วงเวลา Debounce: ${DEBOUNCE_MS / 1000} วินาที (ป้องกันการสกัดซ้ำขณะคนกำลังพิมพ์)`);
  console.log(`💡 คำแนะนำ: เมื่อมีการแก้ไขไฟล์ Excel บน SharePoint โฟลเดอร์จะซิงค์`);
  console.log(`   และสคริปต์จะแปลงข้อมูลเข้า Web App ให้ทันทีโดยไม่ต้องรันมือค่ะ`);
  console.log(`   กด Ctrl+C เพื่อหยุดการทำงาน`);
  console.log(`============================================================\n`);

  // Initialize meta file with current timestamp
  updateMetaFile('watcher-start');

  try {
    const watcher = fs.watch(TARGET_DIR, { recursive: false }, onFileEvent);

    watcher.on('error', (err) => {
      console.error(`[${formatNow()}] ❌ Watcher Error:`, err.message);
    });

    process.on('SIGINT', () => {
      console.log(`\n[${formatNow()}] 🛑 กำลังปิด Auto-Sync Watcher... ขอบคุณค่ะพี่ A!`);
      watcher.close();
      process.exit(0);
    });
  } catch (err) {
    console.error(`[${formatNow()}] ❌ ไม่สามารถเริ่มเฝ้าดูโฟลเดอร์ "${TARGET_DIR}":`, err.message);
    console.error('กรุณาตรวจสอบว่ามีโฟลเดอร์ดังกล่าวอยู่จริงหรือไม่ หรือระบุด้วยคำสั่ง:');
    console.error('node scripts/watch-logbooks.mjs --dir "C:\\Path\\To\\SharePoint\\Folder"');
  }
}

startWatching();
