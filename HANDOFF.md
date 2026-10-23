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

### แนวทาง B: Deploy ขึ้น Cloud / Intranet Web Server (⭐ แนะนำที่สุดสำหรับการใช้งานทั้งโรงงาน)
1. **สถาปัตยกรรม:** Build เว็บแอปเป็น Static Production Asset (`npm run build`)
2. **Deploy ไปยังโฮสติ้ง:**
   - ใช้งาน **Cloudflare Pages / Workers** หรือ **GitHub Pages**
   - นำไฟล์ `dist/` และ `public/data/logbook_2026.json` ขึ้นโฮสติ้ง
3. **ข้อดี:**
   - ทุกคนในโรงงานเปิดผ่าน URL ลิงก์เดียว (เช่น `https://pta1-logbook.pages.dev`)
   - ใช้งานได้จากคอมพิวเตอร์ทุกเครื่อง แท็บเล็ต หรือมือถือในโรงงาน
   - ไม่ต้องติดตั้ง Node.js หรือเปิดคอมพิวเตอร์เครื่องใดเครื่องหนึ่งทิ้งไว้ 24 ชม.

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

## 📞 6. ข้อมูลติดต่อและผู้ดูแลระบบ
- **เจ้าของระบบ:** ศุภสิทธิ์ อุทัย (พี่ A · รหัส 26007294 · โทรศัพท์/LINE: ภายในโรงงาน)
- **ตำแหน่ง:** Boardman PTA Unit 1 / Production Engineer
- **หน่วยงาน:** Production Section PE1, GC-M PTA (เครือ PTTGC), นิคมฯ มาบตาพุด จ.ระยอง
