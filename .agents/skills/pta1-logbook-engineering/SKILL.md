---
name: pta1-logbook-engineering
description: >-
  Comprehensive engineering runbook, architecture patterns, and domain procedures for PTA1 Logbook Insight & IPS Studio.
  Activate when developing, maintaining, debugging, testing, or extracting data for the PTA1 Logbook Insight project,
  handling GC-M PTA DCS logbook parsing, IPS opportunity hunting, Boardman troubleshooting copilot, or Supasit.A Studio Web App standards.
---

# PTA1 Logbook Insight & IPS Studio — Engineering Runbook & Skill

คู่มือขั้นตอนการทำงาน มาตรฐานสถาปัตยกรรม และสูตรคำนวณทางวิศวกรรมสำหรับระบบ **PTA1 Logbook Insight & IPS Studio** ของโรงงาน GC-M PTA Unit 1

---

## 👤 บริบทและผู้ใช้งานหลัก (Plant Context)
- **ผู้ใช้งานหลัก:** พี่ A (คุณศุภสิทธิ์ อู่อุทัย · `C ศุภสิทธิ์`)
- **ตำแหน่ง/บทบาท:** Process/Production Engineer & DCS Boardman PTA Unit 1, Section PE1, โรงงาน GC-M PTA (เครือ PTTGC) นิคมฯ มาบตาพุด
- **แบรนด์/ดีไซน์:** "A-Class WebCraft | Code • Share • Inspire | by Supasit.A" (Supasit.A Studio)
- **บุคลิกการสื่อสารของ Agent:** ตอบภาษาไทย 70% / อังกฤษ 30% ทางการแต่เป็นกันเอง เรียกผู้ใช้ว่า "พี่ A" แทนตัวเองว่า "หนู" ลงท้ายด้วย "ค่ะ" ทุกประโยค (ห้ามใช้ "ครับ")

---

## 🏗️ 1. สถาปัตยกรรม 9 Core Modules (Multi-File Vite + ES Modules)

โปรเจกต์นี้ใช้โครงสร้าง **Multi-File (Vite + ES Modules)** แบบไม่มี Framework ภายนอก (Vanilla JS + Local-First IndexedDB) โดยมี 9 โมดูลหลักใน `src/modules/`:

| Module | ไฟล์ | หน้าที่และความรับผิดชอบ |
| :--- | :--- | :--- |
| `APP_CONFIG` | [`src/modules/app-config.js`](../../src/modules/app-config.js) | ค่าคงที่ระบบ, Target metrics (`4-CBA ≤ 15 ppm`), Symptom Rules, Hunter Weights, 4 Preset IPS Cases |
| `STATE_STORE` | [`src/modules/state-store.js`](../../src/modules/state-store.js) | Reactive Pub/Sub state (Active filters, search query, copilot state, hunter candidates) |
| `STORAGE_ENGINE` | [`src/modules/storage-engine.js`](../../src/modules/storage-engine.js) | IndexedDB CRUD (`pta1_logbook_db` v1) + Web Crypto AES-GCM 256-bit API key storage |
| `LOGBOOK_PARSER` | [`src/modules/logbook-parser.js`](../../src/modules/logbook-parser.js) | สกัด Tag อุปกรณ์, จัดกลุ่ม 6 อาการ, วิเคราะห์ 7 มาตรการแก้ไข, คำนวณสูตร IPS 1.1, Pareto 80/20 |
| `GEMINI_AI_BRIDGE`| [`src/modules/gemini-ai-bridge.js`](../../src/modules/gemini-ai-bridge.js) | เชื่อมต่อ Gemini 2.5 Flash API สำหรับร่าง Kaizen 7 ขั้นตอน และ Five-Why Analysis |
| `UI_RENDERER` | [`src/modules/ui-renderer.js`](../../src/modules/ui-renderer.js) | Render DOM อย่างปลอดภัย (XSS-Safe ด้วย `textContent`), Timeline, Badges, Charts, Copilot Panel |
| `DEBUG_MODULE` | [`src/modules/debug-module.js`](../../src/modules/debug-module.js) | Error taxonomy, Performance benchmark, Console audit logger |
| `APP_CORE` | [`src/main.js`](../../src/main.js) | App initialisation, Event listener orchestration, Service coordination |

---

## 🔄 2. Data Pipeline & Auto-Ingestion Runbook

### แหล่งข้อมูลและการสกัดไฟล์ Excel (.xlsm)
1. **ไฟล์ต้นทาง:** จัดเก็บในโฟลเดอร์ `logbooks/` (เช่น `PTA1_Logbook_Oct2026.xlsm`)
2. **การรันสกัดข้อมูล:**
   - แบบครั้งเดียว: `npm run extract` หรือ `node scripts/extract-logbooks.mjs`
   - แบบเฝ้าสังเกตอัตโนมัติ (Debounce 8 วินาที กรองไฟล์ชั่วคราว `~$*`): `node scripts/watch-logbooks.mjs`
3. **ผลลัพธ์การสกัด:**
   - ฐานข้อมูลรวม: `public/data/logbook_2026.json` (4,560+ บันทึก ตั้งแต่ ม.ค. - ต.ค. 2569)
   - ไฟล์ Metadata ขนาดเล็กสำหรับ Web App Live Polling: `public/data/logbook_meta.json`

---

## 🧮 3. โค้ดตรรกะทางวิศวกรรมเฉพาะทาง (Domain Engineering Logic)

### ก. การสกัด Tag เครื่องจักร (Equipment Tag Regex)
ใช้นิพจน์เรกิวลาร์ในการจับรูปแบบรหัสอุปกรณ์ของ PTA1:
- Prefix มาตรฐาน: `P-`, `PP-`, `PJ-`, `PM-`, `PZ-`, `PT-`, `PTK-`, `F-`, `FCV-`, `L-`, `LCV-`, `PCV-`, `TI-`, `XV-`
- รูปแบบหลัก: `/\b([A-Z]{1,4}-\d{3,4}[A-Z]?)\b/gi`

### ข. การจัดกลุ่ม 6 อาการผิดปกติ DCS (Symptom Matchers)
1. `hunting` — การแกว่ง, คอนโทรลเลอร์แกว่ง, MV สูง, Fluctuate
2. `alarm` — Alarm ร้อง, High/Low alarm, Hi-Hi
3. `trip` — ปั๊มตัด, Interlock ทำงาน, Trip, Motor overload
4. `clogged` — ไส้กรองตัน, ท่อตัน, DP สูง, Flow ไม่ออก
5. `leak` — รั่ว, มีละอองน้ำกรด, ซึมตาม Flange, Seal leak
6. `exapilot` — Exapilot หยุดชะงัก, Sequence ค้าง, รอ Operator confirm

### ค. การจำแนก 7 มาตรการแก้ไขปัญหาหน้างาน (Proven Action Classification)
1. `flush` ➔ Flush Line & Clean Valve (ล้างท่อ/ชะล้างสารตกค้าง)
2. `tune` ➔ Control Tuning & Adjust SP/MV (ปรับจูนค่าควบคุม DCS)
3. `silo_switch` ➔ Silo & Conveying Switch (สลับถังไซโลหรือเส้นทางขนส่ง)
4. `speed` ➔ Speed & Agitator Adjust (ปรับความเร็วรอบใบกวน/ฟีดเดอร์)
5. `cut_feed` ➔ Temporary Feed Cut / Bypass (ตัดฟีดชั่วคราวหรือบายพาส)
6. `wash` ➔ Chemical / Water Washing (ล้างระบบด้วยน้ำร้อนหรือกรด)
7. `mechanical` ➔ F/O & Mechanical Check (ประสานงาน Field Operator ตรวจสอบหน้างาน)

### ง. สูตรคำนวณผลตอบแทน IPS (Formula 1.1)
```text
Net Benefit = (1. Cost Saving + 2. Manhours Saving) - (4. Depreciation + 5. Operating Cost)
สูตรในระบบ:
Benefit (บาท/ปี) = (costSaving + (manHours * hourlyRate)) - (investYear + extraCost)
```

---

## 🛡️ 4. กฎเหล็กด้านความปลอดภัยและคุณภาพ (Quality & Security Gates)

1. **ห้ามใช้ `innerHTML` กับข้อมูลจาก Logbook หรือ Input ผู้ใช้เด็ดขาด:**
   - ใช้ `document.createElement`, `textContent`, หรือ Helper DOM APIs เพื่อป้องกันช่องโหว่ Cross-Site Scripting (XSS)
2. **การรักษาความปลอดภัย API Key:**
   - กุญแจ Google Gemini API Key ต้องเข้ารหัสด้วย `crypto.subtle` (AES-GCM 256-bit) เก็บไว้ใน IndexedDB ของผู้ใช้เท่านั้น ห้าม Hardcode ในโค้ด
3. **Contrast และ UI Rules (Supasit.A Studio):**
   - ปุ่ม Interactive: Ink Blue `#1D4ED8`
   - แถบอ้างอิง/เตือน: Amber `#8A6410`
   - Contrast Ratio ≥ 4.5:1 ทั้ง Light Mode และ Dark Mode
   - Touch Target บนหน้าจอมือถือ/แท็บเล็ต ≥ 44px
4. **Red-Green Code Verification (TDD):**
   - ก่อนรายงานว่าส่งงานหรือฟังก์ชันพร้อมใช้งาน ต้องรัน `npm run check` (Vitest + Vite Build) และผลต้องเป็น **26/26 Tests Passed** เสมอ

---

## 📋 5. สรุปคำสั่งที่ใช้เป็นประจำ (CLI Cheat Sheet)
- `npm run dev` — รัน Local Development Server (Vite)
- `npm test` — รัน Vitest Unit Tests
- `npm run check` — รันทั้ง Unit Tests และ Vite Production Build (บังคับก่อน Commit)
- `npm run extract` — สกัดข้อมูลจากไฟล์ `.xlsm` ใน `logbooks/` เป็น JSON
- `node scripts/watch-logbooks.mjs` — เฝ้าจับการเปลี่ยนแปลงไฟล์ Excel อัตโนมัติ
