/**
 * ① APP_CONFIG — Design Tokens, Plant Constants, and Pre-loaded IPS/Kaizen Templates
 * Brand: A-Class WebCraft | Code • Share • Inspire | by Supasit.A
 */
export const AppConfig = {
  APP_NAME: 'PTA1 Logbook Insight & IPS Studio',
  BRAND_SUBTITLE: 'A-Class WebCraft • Code • Share • Inspire • by Supasit.A',
  VERSION: '1.0.0',
  DB_NAME: 'pta1_logbook_db',
  DB_VERSION: 1,
  DEFAULT_BM: 'C ศุภสิทธิ์',
  DATA_URL: './data/logbook_2026.json',
  META_URL: './data/logbook_meta.json',
  GEMINI_MODEL: 'gemini-2.5-flash',
  TARGETS: {
    CBA_MAX: 15.0,
    PTA_MIN: 100,
    PTA_MAX: 175,
    LOAD_NORMAL: 100
  },
  PRESET_IPS_DRAFTS: [
    {
      id: 'ips-oct-lcv2302',
      sourceId: '2026-10-13-N-DW-136',
      date: '2026-10-13 (Night)',
      tags: ['LCV-2302', 'TM-2302F', 'TM-2302D'],
      jobName: 'การปรับปรุงการควบคุมวาล์ว LCV-2302 เพื่อลดปัญหา Alarm MV Up ซ้ำซ้อน',
      caseName: 'ปรับจูนพารามิเตอร์ Timer Sequence (TM-2302F และ TM-2302D) ของวาล์ว LCV-2302',
      section: 'PE1',
      objective: 'เพิ่มประสิทธิภาพ(ความสะดวก,ลดเวลาล่าช้า) / เพิ่ม Reliability',
      kaizenWay: '3.Modification',
      beforeText:
        'ในการเดินเครื่องหน่วย PTA Unit 1 พบปัญหาวาล์ว LCV-2302 เกิดอาการ Fouling สะสมทำให้เกิด Alarm MV Up บ่อยครั้ง โดยเมื่อวันที่ 06/10/2026 ได้มีการปรับเพิ่มเฉพาะเวลาเปิด-ปิด (TM-2302F) จาก 16 เป็น 17 วินาที แต่ในวันที่ 13/10/2026 ยังคงพบปัญหา LCV-2302 Alarm MV Up เกิดขึ้นซ้ำอีก เนื่องจากรอบเวลาการทำงานของ Sequence (TM-2302D) ที่ตั้งไว้ 300 วินาที ห่างเกินไป ทำให้เกิดการสะสมของคราบตะกรันในจังหวะรอและรบกวนสมาธิของ Boardman ในการเฝ้าระวังหน้าจอ DCS',
      afterText:
        'Boardman ได้วิเคราะห์พฤติกรรมการเกิด Fouling ของวาล์ว LCV-2302 และดำเนินการปรับจูนพารามิเตอร์ควบคู่กัน 2 จุด เมื่อวันที่ 13/10/2026 ได้แก่:\n1. ปรับเพิ่มเวลาเปิด-ปิดวาล์ว (TM-2302F) จาก 17 วินาที เป็น 18 วินาที เพื่อให้จังหวะชะล้างต่อครั้งสมบูรณ์ขึ้น\n2. ปรับลดรอบเวลา Sequence (TM-2302D) จาก 300 วินาที ลงเหลือ 250 วินาที เพื่อเพิ่มความถี่ในการขยับวาล์วป้องกันการสะสมตัวของผงตะกรัน',
      effectText:
        'หลังจากปรับจูน TM-2302F = 18 วินาที และ TM-2302D = 250 วินาที ค่า MV ของวาล์ว LCV-2302 กลับเข้าสู่สภาวะปกติทันที และจากการติดตามผลตั้งแต่วันที่ 14–23/10/2026 (10 วันต่อเนื่อง) ไม่พบปัญหา LCV-2302 Alarm MV Up เกิดซ้ำอีกเลย ช่วยลด Chattering Alarm บนหน้าจอ DCS และรักษาเสถียรภาพของกระบวนการผลิตได้อย่างต่อเนื่อง',
      rootCauseText:
        'อาการที่พบ: วาล์ว LCV-2302 เกิด Alarm MV Up ซ้ำในวันที่ 06/10 และ 13/10/2026\nWhy 1 → เพราะมีคราบ Slurry/ผง PTA สะสมที่บ่าวาล์วจนวาล์วต้องเปิด MV สูงขึ้นเรื่อยๆ\n  └─ Why 2 → เพราะจังหวะการขยับชะล้างตาม Sequence เดิม (TM-2302F = 17 sec) ยังไม่เพียงพอ และระยะเวลารอระหว่างรอบ (TM-2302D = 300 sec) นานเกินไป\n       └─ Why 3 → เพราะการแก้ปัญหาครั้งก่อน (06/10) ปรับเพิ่มเฉพาะระยะเวลาเปิด (Duration) เพียงอย่างเดียว แต่ไม่ได้ลดระยะเวลาทิ้งช่วง (Interval = 300 sec)\n            └─ Root Cause: พารามิเตอร์ Sequence ของ LCV-2302 ไม่สมดุลกับสภาวะความเข้มข้นของ Slurry ปัจจุบัน',
      benefitCalc: {
        costSaving: 0,
        manHours: 2,
        hourlyRate: 0,
        oppLossTons: 0,
        tonRate: 0,
        investYear: 0,
        extraCost: 0
      }
    },
    {
      id: 'ips-oct-pp404a-exapilot',
      sourceId: '2026-10-09-D-DW-89',
      date: '2026-10-09, 15, 23',
      tags: ['PP-404A', 'LCV-2404A', 'EXAPILOT'],
      jobName: 'การจัดการปัญหาปั๊ม PP-404A Fouling เชิงรุกด้วยระบบอัตโนมัติ Exapilot',
      caseName: 'ใช้สัญญาณ LCV-2404A MV = 100% ตัดสินใจเดิน Sequence หยุดปั๊ม PP-404A เพื่อล้าง NaOH ผ่าน Exapilot ก่อนปั๊ม Loss Suction',
      section: 'PE1',
      objective: 'เพิ่ม Reliability / Digitalization / เพิ่มประสิทธิภาพ(ความสะดวก,ลดเวลาล่าช้า)',
      kaizenWay: '2.Application / 3.Modification',
      beforeText:
        'ในการเดินเครื่องปั๊ม PP-404A/B มักเกิดปัญหาคราบตะกรันอุดตัน (Fouling) ในสายท่อและตัวปั๊ม (ในเดือน ต.ค. 2026 เกิดขึ้นรวม 7 ครั้ง) ซึ่งหากปล่อยให้เกิดการอุดตันจนปั๊มสูญเสียแรงดูด (Loss Suction) หรือเกิด Overload Trip จะทำให้ระดับในถังแกว่งตัวรุนแรงและเพิ่มภาระงานฉุกเฉินให้ทั้ง Boardman และ Field Operator',
      afterText:
        'เฝ้าระวังสัญญาณเตือนล่วงหน้าจากตำแหน่งเปิดของวาล์วควบคุม LCV-2404A เมื่อพบว่าค่า MV เปิดสุดถึง 100% (บ่งชี้ว่าเริ่มเกิด Fouling สะสมในระบบท่อส่งของ PP-404A) Boardman จึงสั่งรัน Sequence บนระบบ Yokogawa Exapilot เพื่อทำการสลับ/หยุดปั๊ม PP-404A และดำเนินการล้างด้วยสารละลายโซดาไฟ (NaOH Washing) ตามขั้นตอนมาตรฐานทันที (ดำเนินการสำเร็จในกะวันที่ 09/10, 15/10 และ 23/10/2026)',
      effectText:
        'สามารถชะล้างคราบ Fouling ในปั๊ม PP-404A และวาล์ว LCV-2404A ให้กลับมาเปิดควบคุมได้ในย่านปกติทุกครั้งโดยไม่เกิดเหตุปั๊ม PP-404A Trip เลย ลดความผิดพลาดจากการสั่งงานแบบ Manual หลายขั้นตอนด้วยระบบอัตโนมัติ Exapilot และรักษาความต่อเนื่องของกระบวนการผลิตได้อย่างปลอดภัย',
      rootCauseText:
        'อาการที่พบ: ปั๊ม PP-404A เกิด Fouling สะสมจนเสี่ยงต่อการเกิด Loss Suction\nWhy 1 → เพราะมีคราบ Slurry PTA เกาะสะสมในสายท่อและตัวปั๊มขณะเดินเครื่องต่อเนื่อง\n  └─ Why 2 → หากรีรอจนกระแสปั๊มแกว่งหรือ Loss Suction จะทำให้เกิดการสะดุดของระบบ\n       └─ Root Cause: ต้องใช้สัญญาณเตือนล่วงหน้า (LCV-2404A MV = 100%) ร่วมกับ Sequence อัตโนมัติบน Exapilot เข้าชะล้างด้วย NaOH ก่อนถึงจุดวิกฤต',
      benefitCalc: {
        costSaving: 0,
        manHours: 3,
        hourlyRate: 0,
        oppLossTons: 0,
        tonRate: 0,
        investYear: 0,
        extraCost: 0
      }
    },
    {
      id: 'ips-oct-fc2701',
      sourceId: '2026-10-03-N-DW-130',
      date: '2026-10-03 (Night)',
      tags: ['FC-2701', 'LCV-2301', 'LCV-2401'],
      jobName: 'การป้องกันปัญหาวาล์ว LCV-2301 ตัน (Fouling) จากการแกว่งของอัตราการไหล MPW',
      caseName: 'ปรับเพิ่ม Setpoint ของ FC-2701 เพื่อลดอาการ PV Swing และป้องกัน LCV-2301 Fouling',
      section: 'PE1',
      objective: 'เพิ่ม Reliability / ปรับปรุงคุณภาพผลิตภัณฑ์และบริการ',
      kaizenWay: '4.Maximize / 3.Modification',
      beforeText:
        'เมื่อวันที่ 03/10/2026 ขณะเดินเครื่องที่อัตราการไหล MPW (FC-2701) ที่ระดับ 1,000 kg/hr พบว่าค่า PV ของ FC-2701 เกิดอาการแกว่งตัว (PV Swing) อย่างต่อเนื่อง ซึ่งหากปล่อยให้เกิดการแกว่งตัวของอัตราการไหล MPW สะสมเป็นเวลานาน จะส่งผลให้เกิดการอุดตัน (Fouling) ที่วาล์วควบคุมระดับ LCV-2301 ตามมาได้',
      afterText:
        'ดำเนินการปรับเพิ่มอัตราการไหลของ FC-2701 จาก 1,000 kg/hr เป็น 1,050 kg/hr เพื่อรักษาแรงดันและอัตราการไหลของน้ำ MPW ให้พ้นย่านที่เกิดการแกว่งตัว (PV Swing) เป็นการแก้ปัญหาเชิงรุก (Preventive Action) ก่อนที่ตะกรันจะสะสมที่วาล์ว LCV-2301',
      effectText:
        'ค่า PV ของ FC-2701 นิ่งขึ้นทันที ไม่เกิดอาการแกว่งตัว และตลอดช่วงวันที่ 01–23/10/2026 ไม่พบปัญหาวาล์ว LCV-2301 อุดตันหรือทำงานผิดปกติเลย',
      rootCauseText:
        'อาการที่พบ: ค่า PV ของ FC-2701 แกว่งตัวเมื่อเดินที่ Setpoint 1,000 kg/hr\nWhy 1 → อัตราการไหล 1,000 kg/hr อยู่ใกล้ขอบเขตการแกว่งของแรงดันน้ำ MPW ในสภาวะโหลดปัจจุบัน\n  └─ Why 2 → เมื่อน้ำ MPW ไหลไม่สม่ำเสมอ จะทำให้เกิดการตกค้างของผงที่บ่าวาล์ว LCV-2301\n       └─ Root Cause: Setpoint เดิม (1,000 kg/hr) มี Margin ต่ำเกินไป ต้องขยับขึ้นเป็น 1,050 kg/hr เพื่อให้การไหลมีเสถียรภาพ',
      benefitCalc: {
        costSaving: 0,
        manHours: 1.5,
        hourlyRate: 0,
        oppLossTons: 0,
        tonRate: 0,
        investYear: 0,
        extraCost: 0
      }
    },
    {
      id: 'kaizen-oct-pm104',
      sourceId: '2026-10-11-D-DW-92',
      date: '2026-10-11 (Day)',
      tags: ['PM-104', 'PI-2105', 'PD-2104', 'PRV-2104', 'PG-2107', 'FC-1401'],
      jobName: 'การตรวจสอบเชิงรุกและปรับสมดุลระบบลมเป่า PM-104 เพื่อลดการหยุดส่งผง (Cut Transfer FC-1401)',
      caseName: 'แก้ไขสาย 7N Purge ที่ PRV-2104 และปรับลดแรงดัน PG-2107 ของ PM-104 จาก 0.35 เหลือ 0.10 kg/cm²',
      section: 'PE1',
      objective: 'เพิ่ม Reliability / ลดเวลาสูญเสียในการลำเลียงผง PTA',
      kaizenWay: '3.Modification / 5.Minimize',
      beforeText:
        'ในเดือน ต.ค. 2026 (วันที่ 1–23 ต.ค.) พบปัญหาความดัน PI-2105 และ PD-2104 ของระบบ PM-104 พุ่งสูงเกินเกณฑ์ (223–340 mmH2O) รวมทั้งสิ้น 26 ครั้ง ทำให้ Boardman ต้องสั่ง Cut Transfer หยุดส่งผง PTA จาก TTK-400 ไปยัง PTK-101 (FC-1401) ครั้งละ 5 นาที คิดเป็นเวลาสูญเสียโอกาสในการลำเลียงผงรวมกว่า 130 นาที/เดือน',
      afterText:
        '1. ตรวจเช็กและประกอบสาย 7N Purge Tube ที่ PRV-2104 ให้แน่นหนา พร้อมตรวจเช็กการทำงานของ Solenoid Valve ทุกตัวของ PM-104\n2. ปรับจูนแรงดัน PG-2107 ของ PM-104 จาก 0.35 kg/cm² ลงมาที่ 0.10 kg/cm² ให้สมดุลกับระบบ\n3. เคาะและเป่าไล่ผงค้างในท่อทางเข้า PT-101 ร่วมกับกำหนดเกณฑ์เฝ้าระวัง PI-2105 ก่อนถึงจุดต้อง Cut Transfer',
      effectText:
        'หลังจากแก้ไขสาย 7N Purge ที่ PRV-2104 และปรับตั้ง PG-2107 ที่ 0.10 kg/cm² เมื่อวันที่ 11/10/2026 ความดัน PI-2105 ลดลงจาก 266 mmH2O กลับลงมาอยู่ในย่านปกติ (~101–125 mmH2O) และ PD-2104 ลดลงจาก 164 mmH2O เหลือ ~36–63 mmH2O ช่วยฟื้นฟูการลำเลียงผงจาก TTK-400 ไป PTK-101 ได้ทันที',
      rootCauseText:
        'อาการที่พบ: ความดัน PI-2105 (>240 mmH2O) และ PD-2104 (>150 mmH2O) พุ่งสูงซ้ำ 26 ครั้ง\nWhy 1 → เพราะเกิดการสะสมของผง PTA อุดตันบริเวณท่อทางเข้า PT-101 และชุดกรอง PM-104\n  └─ Why 2 → เพราะระบบเป่าทำความสะอาด (Purge / Blowback) และแรงดันควบคุมของระบบ PM-104 ทำงานได้ไม่เต็มประสิทธิภาพ\n       └─ Why 3 → จากการตรวจเช็กหน้างานเมื่อวันที่ 11/10/2026 พบว่าสายท่อ 7N Purge Tube ที่วาล์ว PRV-2104 หลุด/หลวม และแรงดัน PG-2107 ตั้งไว้สูงเกินไปที่ 0.35 kg/cm²\n            └─ Root Cause: ข้อต่อสาย 7N Purge ที่ PRV-2104 คลายตัวจากการสั่นสะเทือน และแรงดัน PG-2107 ไม่เหมาะสมกับสภาวะการลำเลียงปัจจุบัน',
      benefitCalc: {
        costSaving: 0,
        manHours: 4.5,
        hourlyRate: 0,
        oppLossTons: 0,
        tonRate: 0,
        investYear: 0,
        extraCost: 0
      }
    }
  ]
};
