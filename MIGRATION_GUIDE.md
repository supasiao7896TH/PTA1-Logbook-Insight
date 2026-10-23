# คู่มือการย้ายโปรเจกต์ไปเครื่อง PC ใหม่ (PC Migration & Recovery Guide)
> **วันที่จัดทำ:** 23 ตุลาคม 2026  
> **กำหนดการเปลี่ยนเครื่อง:** 30 ตุลาคม 2026 (หมดสัญญาเช่า PC เดิม)  
> **สำหรับ:** พี่ A (ศุภสิทธิ์ อุทัย · GC-M PTA Unit 1)  
> **โปรเจกต์:** PTA1 Logbook Insight & IPS Studio  

---

## 🎯 ข่าวดี: สิ่งที่ไม่หายแน่นอน 100% (เพราะอยู่บน Cloud แล้ว)

1. **Source Code ทั้งหมด:** อยู่บน GitHub อย่างปลอดภัยที่ [https://github.com/supasiao7896TH/PTA1-Logbook-Insight](https://github.com/supasiao7896TH/PTA1-Logbook-Insight)
2. **ตัว Web App สำหรับใช้งาน:** Deploy อยู่บน Cloudflare Workers [https://pta1-logbook-insight.supasiao.workers.dev](https://pta1-logbook-insight.supasiao.workers.dev) เปิดใช้งานบนมือถือหรือคอมเครื่องไหนก็ได้ทันที
3. **ไฟล์ Excel ต้นฉบับ:** อยู่บน Microsoft 365 SharePoint / OneDrive ของ GC-M PTA เมื่อล็อกอินบัญชีบริษัทบนเครื่องใหม่ ไฟล์จะซิงค์กลับมาอัตโนมัติ

---

## 📋 1. Checklist สิ่งที่พี่ A ต้องเตรียม "ก่อนส่งคืนเครื่องเก่า" (ก่อนวันที่ 30 ต.ค.)

- [ ] **1.1 สำรองข้อมูลร่าง IPS ในเครื่องเก่า:**
  - บนหน้า Web App ให้คลิกปุ่ม **"💾 สำรองข้อมูล (Backup)"** ระบบจะดาวน์โหลดไฟล์ `pta1_logbook_backup_2026-10-xx.json`
  - ย้ายไฟล์ backup นี้ไปเก็บไว้ใน OneDrive บริษัท หรือ Flash Drive เพื่อนำไปกู้คืนบนเครื่องใหม่
- [ ] **1.2 จดบันทึก Gemini API Key (ถ้ามีใช้งาน):**
  - เปิดหน้าตั้งค่า AI แล้วคัดลอกคีย์เก็บไว้ใน Notepad หรือสมุดบันทึกส่วนตัว
- [ ] **1.3 ยืนยันการ Push โค้ดรอบสุดท้าย:**
  - รันคำสั่ง `git status` ในเครื่องเก่าให้แน่ใจว่าขึ้น `working tree clean` (ไม่มีโค้ดค้าง)
  - รัน `git push origin main` ให้ข้อมูลล่าสุดขึ้น GitHub ทั้งหมด

---

## 🚀 2. ขั้นตอนการตั้งค่าบนเครื่อง PC ใหม่ (ใช้เวลาเพียง 5 - 10 นาที)

เมื่อพี่ A ได้รับเครื่อง PC เครื่องใหม่จากแผนก IT มาแล้ว ให้ทำตามขั้นตอนนี้ได้เลยค่ะ:

### ขั้นตอนที่ 1: ตรวจสอบและติดตั้งโปรแกรมพื้นฐาน
1. **ล็อกอิน OneDrive บริษัท:** ให้แน่ใจว่าโฟลเดอร์ SharePoint `Log book PTA1\Report FM,BM 2026` ซิงค์เข้ามาในเครื่องแล้ว
2. **ติดตั้ง Node.js:** ดาวน์โหลดเวอร์ชัน LTS (v22 หรือ v20) จาก [https://nodejs.org](https://nodejs.org) แล้วกดติดตั้งตามปกติ
3. **ติดตั้ง Git for Windows:** ดาวน์โหลดจาก [https://git-scm.com](https://git-scm.com) (หากยังไม่มีในเครื่อง)

### ขั้นตอนที่ 2: ดึงโปรเจกต์ลงเครื่องใหม่ (Clone Repository)
เปิด **PowerShell** หรือ **Command Prompt** แล้วรันคำสั่งเหล่านี้ตามลำดับ:

```powershell
# 1. ไปยังโฟลเดอร์ที่ต้องการเก็บงาน (เช่น หน้า Desktop หรือโฟลเดอร์โปรเจกต์)
cd C:\Users\26007294

# 2. ดึงโปรเจกต์จาก GitHub
git clone https://github.com/supasiao7896TH/PTA1-Logbook-Insight.git

# 3. เข้าสู่โฟลเดอร์โปรเจกต์
cd PTA1-Logbook-Insight

# 4. ติดตั้งไลบรารีที่จำเป็นทั้งหมด (ใช้เวลา ~15 วินาที)
npm install
```

### ขั้นตอนที่ 3: เปิดใช้งานและทดสอบระบบ
```powershell
# เปิด Web App Dashboard ในเครื่อง
npm run dev
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:5173/` จะเห็นหน้าเว็บ PTA1 Logbook Insight พร้อมข้อมูล 9 เดือนทันที!

### ขั้นตอนที่ 4: กู้คืนข้อมูลร่าง IPS (Restore)
1. เปิดหน้าเว็บ `http://localhost:5173/` บนเครื่องใหม่
2. คลิกปุ่ม **"📥 นำเข้าข้อมูล (Restore)"**
3. เลือกไฟล์ `pta1_logbook_backup_*.json` ที่พี่ A สำรองไว้ ร่าง IPS ทั้งหมดจะกลับคืนมาเหมือนเดิม 100% ค่ะ!

### ขั้นตอนที่ 5: เปิดตัวดึงข้อมูลอัตโนมัติจาก SharePoint (Auto-Sync)
```powershell
npm run sync:live
```
สคริปต์จะเริ่มจับตาดูโฟลเดอร์ SharePoint บนเครื่องใหม่ทันที เมื่อมีคนเซฟไฟล์ Excel ข้อมูลจะไหลเข้าเว็บแอปอัตโนมัติเหมือนเดิมทุกประการค่ะ!

---

## 🔑 3. บัญชีและ Token ที่เกี่ยวข้อง (Security & Credentials Note)

| บริการ | ข้อมูลที่เกี่ยวข้อง | บันทึกช่วยจำ |
|---|---|---|
| **GitHub Repo** | `https://github.com/supasiao7896TH/PTA1-Logbook-Insight` | ล็อกอินผ่านเบราว์เซอร์หรือ GitHub CLI / Personal Access Token |
| **Cloudflare Account** | Account ID: `e87e6b4e7ec59834a35db192e7e37eb8` (User: `supasiao@gmail.com`) | หากต้องการสั่ง deploy จากเครื่องใหม่ รันคำสั่ง `npx wrangler login` เพียงครั้งเดียว |
| **Cloudflare Secret** | `CLOUDFLARE_API_TOKEN` | ผูกไว้ใน GitHub Action Secrets ของ Repository เรียบร้อยแล้ว (ไม่ต้องตั้งใหม่) |
| **Gemini AI API** | BYOK (Bring Your Own Key) | นำคีย์เดิมมากรอกในปุ่ม "⚙️ ตั้งค่า AI" บนหน้าเว็บ |

---

## 📞 หากติดปัญหาในการตั้งค่าเครื่องใหม่
สามารถแจ้งหนู (Antigravity Assistant) หรือเปิดคุยใน Chat นี้ได้เลยนะคะ หนูจะช่วยพารันทีละคำสั่งจนระบบพร้อมทำงาน 100% แน่นอนค่ะ!
