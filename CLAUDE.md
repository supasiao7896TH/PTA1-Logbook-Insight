# CLAUDE.md — PTA1 Logbook Insight & IPS Studio

## Project Context
- **ชื่อแอป:** PTA1 Logbook Insight & IPS/Kaizen Studio
- **เป้าหมาย:** ระบบค้นหาและสกัดข้อมูล Logbook รายเดือนโรงงาน GC-M PTA Unit 1 พร้อมตัวช่วยร่าง IPS (HCL Notes) และ Kaizen Report Card
- **Stack:** Multi-File (Vite + ES Modules) · IndexedDB · Vanilla JS (Safe DOM) · Web Crypto AES-256 · Gemini Flash BYOK
- **Deploy:** GitHub Pages / Cloudflare Workers
- **Branch:** main

## Commands
- `npm run dev` — เปิด Vite Local Dev Server
- `npm test` — รัน Vitest unit tests อย่างเดียว (รวดเร็ว)
- `npm run check` — รัน `vitest run && vite build` (ต้องเขียวก่อน commit/deploy)
- `npm run extract` — สกัดไฟล์ `.xlsx`/`.xlsm` ประจำเดือนทั้งหมดในโฟลเดอร์ออกมาเป็น JSON

## Architecture
- **Pattern:** 9-Module Pattern (Multi-File: 1 module = 1 ES module ไฟล์ใน `src/modules/`)
- **State:** Reactive Pub/Sub via `STATE_STORE`
- **Storage:** Local-First IndexedDB (`pta1_logbook_db`) + Pre-built Cache ใน `public/data/logbook_2026.json`
- **Security:** ป้องกัน XSS ด้วย `textContent` 100%, เข้ารหัสคีย์ด้วย AES-GCM 256-bit

## Brand Rules (Supasit.A Studio)
- **สีหลัก:** Ink Blue `#1D4ED8` (กดได้), Amber `#8A6410` (อ้างอิง Tag อุปกรณ์)
- **สถานะ:** เขียว `#15803D`, ส้มเตือน `#B45309`, แดงวิกฤต `#B91C1C`
- **ทรง:** ปุ่มแคปซูล 999px (สูง ≥44px), การ์ดมุม 13px, เส้นขอบ 1px
- **Contrast:** ≥4.5:1 ทั้งธีมสว่างและมืด

## DO NOT
- ❌ ห้าม hardcode API key ในโค้ด
- ❌ ห้าม push ไฟล์ `*.xlsx` / `*.xlsm` ในโฟลเดอร์ `logbooks/` ขึ้น repo
- ❌ ห้ามใช้ innerHTML กับข้อมูลบันทึก
- ❌ ห้าม deploy หรือ commit โดยที่ `npm run check` ยังไม่เขียว
