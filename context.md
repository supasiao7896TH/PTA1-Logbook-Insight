# context.md — PTA1 Logbook Insight & IPS Studio
> อัปเดตล่าสุด: 23 ต.ค. 2026 | เวอร์ชัน: v1.0.0

---

## 🎯 ภาพรวมและเป้าหมาย
- **ชื่อแอป:** PTA1 Logbook Insight & IPS/Kaizen Studio
- **เป้าหมาย:** ระบบสกัด แปลง และค้นหาย้อนหลังสำหรับไฟล์ Logbook ประจำเดือนของโรงงาน GC-M PTA Unit 1 จากไฟล์ Excel (.xlsx / .xlsm) ขนาดใหญ่กว่า 440 MB สู่ฐานข้อมูลความเร็วสูง พร้อมเครื่องมือคัดกรองเหตุการณ์หน้างานและร่างฟอร์ม **IPS (HCL/Lotus Notes)** และ **Kaizen Report Card (7 หัวข้อ + Why-Why Analysis)** อัตโนมัติ
- **ผู้ใช้หลัก:** พี่ A (Supasit Aoothai · `C ศุภสิทธิ์` · Boardman PTA Unit 1 · Section PE1)
- **Status:** Phase 1 (Local-First Multi-File App พร้อมฐานข้อมูล ม.ค. – ต.ค. 2026 ครบ 9 เดือน)

---

## 🏗️ Architecture

### Stack (Multi-File Vite + ES Modules)
- **Frontend:** Vite 6 + ES Modules + Tailwind CSS CDN + Vanilla JS (No Framework)
- **Design System:** Supasit.A Studio (Ink Blue `#1D4ED8`, Amber `#8A6410`, Ground `#F7F9FC`, Surface `#FFFFFF`, 1px line, 13px card radius, 999px pills)
- **Storage:** Local-First IndexedDB (`pta1_logbook_db` v1) + Static JSON Cache (`public/data/logbook_2026.json`)
- **Crypto:** Web Crypto AES-GCM 256-bit สำหรับเก็บ Gemini API Key ปลอดภัยในเครื่อง
- **AI:** Gemini 2.5 Flash (BYOK Optional สำหรับช่วยเกลาสำนวนและวิเคราะห์ Why-Why)
- **Deploy:** GitHub Pages / Cloudflare Workers
- **Test/CI:** Vitest 3 (`npm test` / `npm run check`)
- **Repo:** https://github.com/supasiao7896TH/PTA1-Logbook-Insight
- **Branch:** main

### JS Modules (9-Module Pattern)
| Module | ไฟล์ (`src/modules/`) | หน้าที่ |
|---|---|---|
| `APP_CONFIG` | `app-config.js` | Design tokens, Target metrics (`4-CBA ≤ 15 ppm`), Preloaded IPS/Kaizen cases |
| `STATE_STORE` | `state-store.js` | Reactive Pub/Sub state (filters, active tab, drafts) |
| `STORAGE_ENGINE` | `storage-engine.js` | IndexedDB CRUD + AES-GCM 256-bit API key storage |
| `LOGBOOK_PARSER` | `logbook-parser.js` | Tag extraction, multi-filter search, stats computation, IPS formula 1.1, client-side .xlsx/.xlsm stream parser |
| `GEMINI_AI_BRIDGE` | `gemini-ai-bridge.js` | Optional Gemini Flash BYOK auto-drafter |
| `UI_RENDERER` | `ui-renderer.js` | XSS-safe DOM renderer, Highlight query, Toast, Dynamic views |
| `DEBUG_MODULE` | `debug-module.js` | Error taxonomy & Audit logger |
| `APP_CORE` | `src/main.js` | App init, routing, event orchestration |

### Data Schema (IndexedDB: `pta1_logbook_db`)
```text
Store: custom_months
  monthKey    : string (PK, e.g. "2026-11")
  monthMeta   : { monthKey, label, fileName, daysCount, entriesCount }
  daysSummary : Array<{ date, day, dayFm, dayBm, nightFm, nightBm, dayCba, nightCba, prod, dp2500... }>
  entries     : Array<{ id, monthKey, date, day, shift, fm, bm, cba, pta, load, prod, dp2500, category, row, text, tags }>

Store: ips_drafts
  id          : string (PK)
  sourceId    : string
  date        : string
  tags        : string[]
  jobName     : string
  caseName    : string
  section     : string
  objective   : string
  kaizenWay   : string
  beforeText  : string
  afterText   : string
  effectText  : string
  rootCauseText : string
  benefitCalc : { costSaving, manHours, hourlyRate, oppLossTons, tonRate, investYear, extraCost }
  updatedAt   : number

Store: settings
  key         : string (PK)
  value       : any
```

---

## 🎨 Brand & Design Rules (Supasit.A Studio)
- **ST-01:** สีปุ่มกด Ink Blue `#1D4ED8` ห่างจากสีสถานะ (`#15803D`, `#B45309`, `#B91C1C`) ≥50° บนวงล้อสี
- **ST-02:** มิติความลึกมาจากขอบ 1px (`#CBD5E1`) + เงาบางชั้นเดียว
- **ST-03:** ปุ่มแคปซูล `999px` (ความสูงแตะ ≥44px) แต่การ์ดมุม `13px`
- **ST-04:** อัตราส่วน Contrast ผ่านเกณฑ์ ≥4.5:1 ทั้งธีมสว่างและธีมมืด
- **ป้ายอุปกรณ์ (Reference Tag):** สี Amber `#8A6410` (พื้น `#FEF3C7` ขอบ `#F59E0B`)

---

## 📋 Pages & Features
| หน้า / Feature | Status | หมายเหตุ |
|---|---|---|
| 🔍 ค้นหาย้อนหลัง (9 เดือน) | ✅ Done | รวม 4,543 รายการ (QC, Daily Work, Silo, Wash, Regular, SAP) เรียงตามแกนเวลากะโรงงานจริง (07:30–19:30 / 19:30–07:30) เปิดมาเจอเดือนล่าสุดทันที พร้อมปุ่มสลับ Newest/Chronological |
| 🌾 Silo & โลจิสติกส์ขนส่งผง | ✅ Done | สรุปประวัติการสลับ Silo 800 (A/B/C) และปลายทาง PTK810A/B/C, 820A/B รวม 1,128 รายการ |
| 🧼 PM-901 & ล้างเครื่องจักร | ✅ Done | รอบทำ High Pressure, Batch สะสม, ล้าง PP-404A/B, PJ-404, PM-901, LI-2901 รวม 113 ครั้ง พร้อม Quick Filter Chips |
| 📋 Regular Work รอบประจำ | ✅ Done | ตรวจจับ 7 งาน Routine บำรุงรักษา (PZ-601, PT-501, PP-101, PI-2412, PP-102, PT-401, LCV-2301-3) ที่ทำจริง 87 ครั้ง ด้วย Strict Timestamp Rule พร้อมปุ่มกรอง 9 งาน |
| 🛠️ งานแจ้งซ่อม SAP & Memo | ✅ Done | คลังใบสั่งงาน SAP No., งานค้างส่งเวร, ปัญหาไส้กรอง PM-500B, วาล์ว FCV-2412 รวม 139 รายการ |
| 📊 ภาพรวมรายเดือน & กะพี่ A | ✅ Done | ตารางสรุป 9 เดือน, รายการตัดสินใจใน 103 กะของพี่ A |
| 🔧 สถิติอุปกรณ์เสียซ้ำ | ✅ Done | Top 30 Chronic Equipment Tags พร้อมตัวอย่างบันทึกและปุ่มกาง Timeline |
| 📋 สตูดิโอร่าง IPS & Kaizen | ✅ Done | 4 เคสเด่น, คำนวณผลตอบแทนข้อ 1.1 (`1+2-4-5`), ปุ่ม Copy วาง HCL Notes |
| 📥 นำเข้าไฟล์ .xlsm/.xlsx หน้าเว็บ | ✅ Done | แตก XML ผ่าน DecompressionStream บนเบราว์เซอร์ ไม่เปลือง RAM |
| 🔄 SharePoint Auto-Sync Watcher | ✅ Done | สคริปต์เฝ้าตรวจจับโฟลเดอร์ SharePoint / OneDrive ด้วย Debounce 8s และกรองไฟล์ล็อก `~$*`, พร้อม Live Polling Meta ใน Web App ทุก 30s |
| ⚡ ปุ่มคลิกซิงค์สด (One-Click Live Sync) | ✅ Done | ปุ่ม `⚡ ซิงค์สดจาก SharePoint` บนหน้าเว็บ พร้อม Auto-Fallback เปิด File Picker บน Cloudflare และสั่งสกัดอัตโนมัติบน Localhost |
| 🚀 One-Click Desktop Launcher | ✅ Done | ไฟล์ `🚀 เปิด PTA1 Logbook (Auto-Sync).bat` บน Desktop สำหรับดับเบิลคลิกสกัดข้อมูลสด + เปิด Web App + เฝ้าไฟล์ SharePoint อัตโนมัติ |
| ⏰ Shift Auto-Sync Task Scheduler | ✅ Done | Windows Task Scheduler รัน `scripts/auto-deploy-shift.mjs` ทุก 07:20 และ 19:20 น. สกัดข้อมูลและ deploy ขึ้น Cloudflare ก่อนส่งเวร 10 นาที ($0 ตลอดชีพ) |
| ⚙️ Gemini AI Key (BYOK) | ✅ Done | เข้ารหัส AES-GCM 256-bit เก็บในเครื่อง |

---

## 📁 โครงสร้างไฟล์
```text
PTA1-Logbook-Insight/
├── logbooks/                    ← จัดเก็บไฟล์ Excel Logbook (.xlsx / .xlsm) ประจำเดือนทั้งหมด (ignore ไม่ขึ้น git)
├── docs/                        ← รวบรวมเอกสารวิเคราะห์และรายงานสรุป
│   ├── 01_IPS_Kaizen_Candidates_Oct2026.md
│   ├── 02_Monthly_Shift_Insight_Oct2026.md
│   └── oct2026_raw_extracted.txt
├── index.html                   ← HTML Markup หลัก และ Design System Tokens
├── package.json                 ← Tooling (Vite + Vitest)
├── .gitignore                   ← ยกเว้น node_modules, dist, logbooks/*.xlsx, logbooks/*.xlsm
├── src/
│   ├── main.js                  ← APP_CORE Entry point & Event wiring
│   └── modules/
│       ├── app-config.js        ← APP_CONFIG & 4 Preset IPS/Kaizen Cases
│       ├── state-store.js       ← STATE_STORE Reactive Pub/Sub
│       ├── storage-engine.js    ← STORAGE_ENGINE IndexedDB & AES-256 Crypto
│       ├── logbook-parser.js    ← LOGBOOK_PARSER Tag Extraction & Calculations
│       ├── gemini-ai-bridge.js  ← GEMINI_AI_BRIDGE BYOK API
│       ├── ui-renderer.js       ← UI_RENDERER Safe DOM & Templates
│       └── debug-module.js      ← DEBUG_MODULE Audit logger
├── scripts/
│   ├── extract-logbooks.mjs     ← Node.js CLI Extractor สำหรับอ่าน 9 เดือนจากโฟลเดอร์ logbooks/
│   └── watch-logbooks.mjs       ← Auto-Sync Watcher เฝ้าโฟลเดอร์ SharePoint/OneDrive ด้วย Debounce 8s
├── tests/
│   └── logbook-insight.test.js  ← Vitest Unit Tests (TDD Coverage 15 tests)
├── public/
│   └── data/
│       ├── logbook_2026.json    ← ฐานข้อมูลสกัดแล้ว 9 เดือน (4,541 บันทึก, 87 Regular Work, 113 Washing, 1,128 Silo, 139 SAP)
│       └── logbook_meta.json    ← Lightweight metadata (<200 B) สำหรับ Web App Live Sync Polling
├── context.md                   ← ไฟล์นี้
├── HANDOFF.md                   ← คู่มือส่งมอบระบบ บันทึกข้อควรระวัง Shared PC และ Roadmap สำหรับทีม
├── agents.md                    ← กฎสำหรับ AI Agent
├── CLAUDE.md                    ← สรุปคำสั่งและสถาปัตยกรรม
└── README.md                    ← คู่มือเริ่มต้นใช้งาน
```
