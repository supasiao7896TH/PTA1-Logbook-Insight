# PTA1 Logbook Insight & IPS/Kaizen Studio

> **🌐 Live Production URL:** [https://pta1-logbook-insight.supasiao.workers.dev](https://pta1-logbook-insight.supasiao.workers.dev)  
> **📱 PWA Ready:** ติดตั้งบนมือถือ (iOS / Android) และใช้งานออฟไลน์ในโรงงานได้ทันที  
> **อัปเดตล่าสุด:** 23 ต.ค. 2026  
> **ผู้ใช้งาน:** พี่ A (Supasit Aoothai · `C ศุภสิทธิ์` · Boardman PTA Unit 1 · GC-M PTA)  
> **แบรนด์:** A-Class WebCraft • Code • Share • Inspire • by Supasit.A  

---

## 📌 ภาพรวมระบบ (Multi-File Vite + ES Modules + Vitest + Cloudflare Workers)

ระบบจัดการฐานความรู้และค้นหาย้อนหลังสำหรับไฟล์ Logbook ประจำเดือนของโรงงาน **GC-M PTA Unit 1** ที่แปลงไฟล์ Excel (`.xlsx` / `.xlsm`) ขนาดใหญ่หลายร้อย MB ให้เป็นฐานข้อมูลค้นหาย้อนหลังความเร็วสูง พร้อมเครื่องมือร่าง **IPS (HCL/Lotus Notes)** และ **Kaizen Report Card (7 หัวข้อ)** อัตโนมัติ

### 📊 ข้อมูลที่สกัดไว้แล้วในระบบ (`public/data/logbook_2026.json`)
- **ครอบคลุม 9 เดือนของปี 2026:** `01.Jan`, `02.Feb`, `03.Mar`, `04.Apr`, `06.Jun`, `07.Jul`, `08.Aug`, `09.Sep`, `10.Oct`
- **จำนวนวันทำการรวม:** `226` วัน
- **รายการบันทึกหน้างานรวมทั้งหมด:** `4,341` รายการ
- **🌾 ข้อมูลการสลับ Silo 800 & โลจิสติกส์ปลายทาง (810/820):** `1,128` เหตุการณ์
- **🛠️ ข้อมูลงานแจ้งซ่อม SAP & Memo ค้างส่งเวร:** `139` รายการ
- **📋 รายการตรวจเช็ก Regular Work & PM Routines:** `2,224` รายการ
- **จำนวนกะที่พี่ A (`C ศุภสิทธิ์`) เข้าเวร:** `103` กะ
- **เวลาที่ใช้สกัดทั้ง 9 ไฟล์ (~446 MB):** `0.63 วินาที` (ด้วย Stream ZIP XML Reader ใน [`scripts/extract-logbooks.mjs`](./scripts/extract-logbooks.mjs))

---

## 🚀 คำสั่งใช้งาน (CLI Commands)

```bash
# 1. เปิด Web App Dashboard บนเครื่อง (Local Dev Server)
npm run dev

# 2. สกัดข้อมูลใหม่เมื่อวางไฟล์ .xlsx / .xlsm เดือนใหม่เพิ่มในโฟลเดอร์
npm run extract

# 3. รัน Unit Tests (Vitest) และตรวจสอบ Production Build
npm test
npm run check
```

> 💡 **การนำเข้าไฟล์หน้าเว็บโดยตรง:** พี่ A สามารถกดปุ่ม **"📥 อัปโหลดไฟล์ .xlsm / .xlsx เพิ่ม"** ที่แถบซ้ายมือของหน้าเว็บเพื่อโยนไฟล์เดือนใหม่เข้าไปเก็บใน IndexedDB ได้ทันทีโดยไม่ต้องรันคำสั่งผ่าน Terminal ค่ะ

---

## 📂 เอกสารวิเคราะห์และคัดกรองเคส IPS/Kaizen
- [`docs/01_IPS_Kaizen_Candidates_Oct2026.md`](./docs/01_IPS_Kaizen_Candidates_Oct2026.md) — 4 เคสเด่นจากหน้างานจริงของพี่ A พร้อมร่างฟอร์ม **IPS (HCL Notes)** ครบ 3 เคส และ **Kaizen Report Card (7 หัวข้อ + Why-Why Analysis)** 2 เคสใหญ่
- [`docs/02_Monthly_Shift_Insight_Oct2026.md`](./docs/02_Monthly_Shift_Insight_Oct2026.md) — รายงานสรุป Insight ประจำเดือน ต.ค. 2026

## 📁 โฟลเดอร์จัดเก็บไฟล์ Logbook
- [`logbooks/`](./logbooks/) — แหล่งเก็บไฟล์ Logbook ต้นฉบับประจำเดือน (`.xlsx` และ `.xlsm`) สำหรับรัน `npm run extract` หรือนำเข้าเพิ่มในแต่ละเดือน
