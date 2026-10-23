# HANDOFF.md — PTA1 Logbook Insight & IPS Studio
> บันทึกส่งมอบระบบ สถาปัตยกรรม และแนวทางต่อยอดการใช้งานในโรงงาน GC-M PTA Unit 1
> อัปเดตล่าสุด: 23 ต.ค. 2026 | ผู้รับผิดชอบหลัก: พี่ A (ศุภสิทธิ์ อุทัย · Boardman PE1)

---

## 📌 1. ภาพรวมโปรเจกต์ (Project Overview)
- **ชื่อระบบ:** PTA1 Logbook Insight & IPS/Kaizen Studio
- **เป้าหมาย:** สกัดและค้นหาข้อมูลประวัติเหตุการณ์หน้างานย้อนหลัง 9 เดือน (ม.ค. – ต.ค. 2026) จากไฟล์ Excel Logbook ขนาดใหญ่กว่า 440 MB บน SharePoint สู่ Web App ความเร็วสูง พร้อมระบบร่างแบบฟอร์ม **IPS (HCL/Lotus Notes)** และ **Kaizen Report Card (7 หัวข้อ + Why-Why Analysis)** อัตโนมัติ
- **สถิติข้อมูลปัจจุบัน:**
  - 📝 รายการบันทึกหน้างานทั้งหมด: **4,543 รายการ**
  - 🌾 ไทม์ไลน์การสลับ Silo 800 & โลจิสติกส์: **1,128 เหตุการณ์**
  - 🧼 รอบล้างเครื่องจักร PM-901 & ล้างสารเคมี: **113 ครั้ง**
  - 📋 งาน Regular Work ตามรอบที่ทำจริง (Strict Timestamp): **87 ครั้ง**
  - 🛠️ งานแจ้งซ่อม SAP & Memo ค้างส่งเวร: **139 รายการ**
  - 👨‍💻 กะที่พี่ A (`C ศุภสิทธิ์`) เข้าเวร: **103 กะ**

---

## 💻 2. ข้อควรระวังและการใช้งานบนเครื่อง Office (Shared PC Multi-User Notes)

ปัจจุบันเครื่องคอมพิวเตอร์ที่รันโปรเจกต์นี้เป็น **เครื่องส่วนกลางของ Office/ห้องควบคุม** ซึ่งมีการใช้งานหลายคนและสลับ Windows User Account ตามกะ:

### ⚠️ ประเด็นสำคัญที่ต้องทราบ:
1. **ตำแหน่งโฟลเดอร์โปรเจกต์ปัจจุบัน:**
   - อยู่ที่: `C:\Users\26007294\A(i)CODER2025TH\PTA1-Logbook-Insight`
   - เมื่อพี่ A กด **"Sign Out"** ออกจาก Windows โปรเซสของ Node.js/Vite Server จะดับลง และผู้ใช้คนอื่น (เช่น `2600xxxx`) จะไม่สามารถเข้าถึงโฟลเดอร์ใน `C:\Users\26007294\` ได้เนื่องจากติดสิทธิ์ Windows ACL
2. **ตำแหน่งโฟลเดอร์ SharePoint / OneDrive:**
   - ทางลัด SharePoint ของกะถูกเชื่อมไว้ที่:
     `%USERPROFILE%\OneDrive - PTT Global Chemical Public Company Limited\Shortcuts\Production - PE Documents\02 - Plant 1\Log book PTA1\Report FM,BM 2026`
   - ปัจจุบันโค้ดใน `vite.config.js` และ `scripts/watch-logbooks.mjs` ปรับใช้ `process.env.USERPROFILE` แบบ Dynamic เรียบร้อยแล้ว (ไม่ฮาร์ดโค้ด `26007294`)
3. **การแยกข้อมูลส่วนบุคคล (Profile Isolation):**
   - ฐานข้อมูล IndexedDB (`pta1_logbook_db`) ในเบราว์เซอร์แยกตาม Windows User
   - ร่าง IPS และ Gemini API Key ที่พี่ A บันทึกไว้จะปลอดภัย 100% ไม่หลุดไปปนกับผู้ใช้งานคนอื่น

---

## 🎯 3. แนวปฏิบัติในการใช้งาน (Operating Guidelines)

### ระยะที่ 1: การใช้งานส่วนตัวของพี่ A (Current - Single User Mode)
- **การออกจากเครื่อง:** หากมีเพื่อนร่วมงานมาใช้เครื่องต่อ **ห้ามกด Sign Out** ให้ใช้วิธี:
  - กดปุ่ม **`Windows + L` (Lock Screen)** หรือ
  - กดปุ่ม **"Switch User"** สลับไปให้เพื่อนล็อกอินเข้า User ของเขา
  - *ข้อดี:* โปรเซส Local Server ของพี่ A จะยังคงรันอยู่เบื้องหลังได้ตามปกติ
- **การเปิดใช้งาน:**
  1. เปิด Terminal ในโฟลเดอร์โปรเจกต์ รัน `npm run dev`
  2. เปิดเบราว์เซอร์ไปที่ [http://localhost:5173/](http://localhost:5173/)
  3. หากต้องการดึงข้อมูลล่าสุดจาก SharePoint ให้กดปุ่ม **`⚡ ซิงค์สด SharePoint`** บนแถบ Sticky Topbar ด้านบนสุดได้ทันที

---

## 🚀 4. แผนงานต่อยอดสำหรับปล่อยให้ทีมใช้งาน (Phase 2 Roadmap: Team Rollout)

เมื่อพี่ A ทดสอบใช้งานจนระบบนิ่งและต้องการขยายผลให้เพื่อน Boardman / วิศวกรใน Plant 1 ใช้งานร่วมกัน แนะนำให้ปฏิบัติตามแนวทางนี้ค่ะ:

### แนวทาง A: ย้ายโฟลเดอร์ไปไว้ไดรฟ์ส่วนกลาง (Local Shared Path)
1. ย้ายโฟลเดอร์จาก `C:\Users\26007294\...` ไปไว้ที่ไดรฟ์สาธารณะ เช่น `C:\PTA1-Logbook-Insight` หรือ `D:\PTA1-Logbook-Insight`
2. ตั้งสิทธิ์โฟลเดอร์ (Folder Properties > Security) ให้กลุ่ม `Users` หรือ `Everyone` มีสิทธิ์ Read/Write
3. ตั้งค่า **Windows Task Scheduler** ให้สั่งรัน `npm run dev` และ `npm run sync:watch` ตั้งแต่เปิดเครื่องคอมพิวเตอร์ (Run whether user is logged on or not)

### แนวทาง B: Deploy ขึ้น Cloudflare Workers & Mobile PWA (⭐ ดำเนินการเสร็จสมบูรณ์แล้ว)
1. **Live Production URL:** [https://pta1-logbook-insight.supasiao.workers.dev](https://pta1-logbook-insight.supasiao.workers.dev)
2. **GitHub Repository:** [https://github.com/supasiao7896TH/PTA1-Logbook-Insight](https://github.com/supasiao7896TH/PTA1-Logbook-Insight)
3. **Cloudflare Account ID:** `e87e6b4e7ec59834a35db192e7e37eb8` (User: `supasiao@gmail.com`)
4. **CI/CD Auto-Deploy:** ทุกครั้งที่มีการ `git push origin main` เวิร์กโฟลว์ `.github/workflows/deploy.yml` จะทำการรัน `npm run check` (Vitest 17 ข้อ + Vite Build) แล้วสั่ง deploy ขึ้น Cloudflare Workers อัตโนมัติผ่าน GitHub Secret `CLOUDFLARE_API_TOKEN`
5. **Mobile PWA Capabilities:**
   - ติดตั้งเป็น Web App บนมือถือได้ทันที (iOS Safari: Share > Add to Home Screen, Android Chrome: Install App)
   - มี Service Worker (`sw.js`) แคชไฟล์สำหรับเปิดใช้งานแบบ Offline ใน Plant ที่ไม่มีสัญญาณเน็ต
   - UI ปรับขนาด responsive บนหน้าจอมือถือ พร้อมปุ่ม `☰ เมนู` สำหรับเปิด/ปิดแถบนำทางและเลือกเดือนอย่างสะดวก
   - ข้อมูล Logbook ซิงค์แบบ Network-First (เมื่อมีเน็ตจะดึงข้อมูลอัปเดตล่าสุด เมื่อออฟไลน์จะดึงจากแคชในเครื่อง)

---

## 🔧 5. สรุปคำสั่งสำคัญในโปรเจกต์ (CLI Reference)

| คำสั่ง | คำอธิบายการทำงาน |
|---|---|
| `npm run dev` | เปิด Local Development Server (Vite) ที่พอร์ต 5173 |
| `npm test` | รัน Vitest Unit Tests (ครอบคลุม 15 ชุดการทดสอบ) |
| `npm run check` | รันทั้ง Unit Tests และ Vite Production Build (Quality Gate) |
| `npm run sync:watch` | เปิด Auto-Sync Watcher เฝ้าดูโฟลเดอร์ SharePoint ด้วย Debounce 8s |
| `npm run sync:live` | รัน Auto-Sync Watcher ชี้ตรงไปยังโฟลเดอร์ SharePoint จริงของพี่ A |
| `npm run extract:live` | สั่งสกัดข้อมูล 9 เดือนจากโฟลเดอร์ SharePoint จริงทันที 1 รอบ |

---

## 📡 7. สถาปัตยกรรม Real-Time Sync ระหว่าง PC & Mobile (Technical Blueprint)

> รายละเอียดฉบับเต็มและไดอะแกรมสถาปัตยกรรม: ดูได้ที่ [`docs/03_Realtime_Sync_Architecture_Blueprint.md`](./docs/03_Realtime_Sync_Architecture_Blueprint.md)

### สรุปสาระสำคัญและจุดตัดสินใจ:
1. **ปัญหาปัจจุบัน:** ข้อมูลบน PC ดึงสดจาก SharePoint ในโรงงานได้ แต่บนมือถือ (Cloudflare Workers) เป็น Snapshot ข้อมูลตอน Deploy จึงยังไม่ Real-time ทันทีที่มีการบันทึก Excel กะใหม่
2. **การรักษาความเสถียรและความเร็วของ Mobile App (ขนาดข้อมูล ~3.8 MB):**
   - **ห้าม** ให้มือถือโหลดไฟล์ 3.8 MB ใหม่ทั้งก้อนทุกครั้ง (จะเปลืองเน็ตและหน่วง)
   - **แนวทางที่ถูกต้อง:** ใช้เทคนิค **Delta Sync (Split Chunks)** โดยแยกข้อมูล 8 เดือนแรก (`logbook_archive.json`) โหลดเก็บใน IndexedDB ในมือถือครั้งเดียวถาวร และคอยโหลดซิงค์เฉพาะ **เดือนปัจจุบัน (`logbook_current.json` ~300 KB)** เมื่อค่า Metadata (`logbook_meta.json` ~300 bytes) มีการเปลี่ยนแปลง
3. **3 แนวทางรอพี่ A ตัดสินใจ:**
   - **แนวทาง A (⭐ แนะนำ):** Cloudflare D1 / KV Database API (เสถียรสุด เบา ไม่กินแรมมือถือ ฟรี 5M reads/วัน)
   - **แนวทาง B:** Firebase Firestore Real-Time Listener (เร็วระดับวินาที WebSocket)
   - **แนวทาง C:** Auto-Push Deploy ผ่าน Watcher บน PC (ง่ายที่สุด ไม่ต้องตั้งฐานข้อมูลเพิ่ม)
4. **ข้อจำกัดจริง:** ต้องมี PC ในห้องคอนโทรลอย่างน้อย 1 เครื่องเปิดรัน Watcher ทิ้งไว้เพื่อเป็นสะพานส่งข้อมูลจาก SharePoint ภายในองค์กรขึ้นสู่ Cloudflare

---

## 🖥️ 8. แผนการย้ายเครื่อง PC ใหม่ (30 ต.ค. 2026)

> รายละเอียดขั้นตอนคำสั่งแบบ Step-by-Step: ดูได้ที่ [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md)

- **ความปลอดภัยของข้อมูล:** โค้ดทั้งหมดปลอดภัย 100% บน GitHub และ Web App รันอยู่บน Cloudflare Workers
- **สิ่งที่ต้องทำก่อนคืนเครื่องเก่า:**
  1. กดปุ่ม **"⚙️ ตั้งค่า & ย้ายเครื่อง"** บนหัวเว็บ ➔ คลิก **"💾 ดาวน์โหลดไฟล์สำรอง (Backup)"** เก็บไฟล์ `.json` เข้า OneDrive
  2. จดบันทึก Gemini API Key ไว้
  3. ตรวจสอบให้แน่ใจว่าได้สั่ง `git push origin main` โค้ดรอบสุดท้ายขึ้น GitHub เรียบร้อยแล้ว
- **เมื่อได้เครื่องใหม่:** ติดตั้ง Node.js, รัน `git clone`, รัน `npm install`, รัน `npm run dev` แล้วกดปุ่ม **"📥 กู้คืนข้อมูล (Restore)"** บนหน้าเว็บ ก็พร้อมทำงานต่อเนื่องทันทีค่ะ

---

## 📞 9. ข้อมูลติดต่อและผู้ดูแลระบบ
- **เจ้าของระบบ:** ศุภสิทธิ์ อุทัย (พี่ A · รหัส 26007294 · โทรศัพท์/LINE: ภายในโรงงาน)
- **ตำแหน่ง:** Boardman PTA Unit 1 / Production Engineer
- **หน่วยงาน:** Production Section PE1, GC-M PTA (เครือ PTTGC), นิคมฯ มาบตาพุด จ.ระยอง
