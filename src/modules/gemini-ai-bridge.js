/**
 * ⑥ GEMINI_AI_BRIDGE — Optional BYOK AI Assistant for IPS/Kaizen Drafting
 */

import { AppConfig } from './app-config.js';
import { StorageEngine } from './storage-engine.js';

export const GeminiAiBridge = {
  async generateIpsFromLogEntry(entry, relatedEntries = []) {
    const apiKey = await StorageEngine.getDecryptedApiKey();
    if (!apiKey) {
      throw new Error('กรุณาตั้งค่า Gemini API Key ในปุ่ม "⚙️ ตั้งค่า AI" ด้านบนก่อนใช้งาน AI ร่างอัตโนมัติค่ะ (หรือใช้งานตัวร่างอัตโนมัติแบบไม่ต้องใช้คีย์ได้ทันทีค่ะ)');
    }

    const historyContext = relatedEntries
      .slice(0, 6)
      .map((r) => `- [${r.date} ${r.shift} | BM: ${r.bm}] ${r.text}`)
      .join('\n');

    const prompt = `คุณคือผู้เชี่ยวชาญการเขียนฟอร์ม IPS (Improvement Sheet) และ Kaizen Report ของโรงงาน GC-M PTA Unit 1 สำหรับพี่ A (Supasit Aoothai, Boardman PTA Unit 1, Section PE1)
จากข้อมูลบันทึกหน้างาน (Logbook) ด้านล่างนี้:
- วันที่เกิดเหตุ: ${entry.date} (${entry.shift} Shift)
- ผู้ปฏิบัติงาน: F/M ${entry.fm || '-'}, B/M ${entry.bm || '-'}
- อุปกรณ์/Tag: ${(entry.tags || []).join(', ') || '-'}
- รายละเอียด: "${entry.text}"

ประวัติเหตุการณ์ที่เกี่ยวข้องกับ Tag เดียวกัน:
${historyContext || '- ไม่มีประวัติก่อนหน้า'}

กรุณาตอบกลับเป็น JSON เท่านั้น โดยมีคีย์ดังนี้:
{
  "jobName": "ชื่องานภาษาไทยกระชับเป็นทางการ",
  "caseName": "ชื่อเรื่องที่ระบุการปรับปรุงและชื่อ Tag ชัดเจน",
  "objective": "เช่น เพิ่ม Reliability / เพิ่มประสิทธิภาพ(ความสะดวก,ลดเวลาล่าช้า)",
  "kaizenWay": "เช่น 3.Modification",
  "beforeText": "ข้อความช่อง ก่อนการปรับปรุง (Before improvement) อธิบายปัญหาและผลกระทบหน้างาน",
  "afterText": "ข้อความช่อง หลังการปรับปรุง (After improvement) อธิบายสิ่งที่ Boardman ดำเนินการแก้ไขพร้อมตัวเลขจริง",
  "effectText": "ข้อความช่อง ประสิทธิภาพหลังการปฏิบัติ (Effectiveness after improvement)",
  "rootCauseText": "วิเคราะห์ Why-Why Analysis 3 ชั้นจากข้อมูลจริง"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${AppConfig.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Gemini API Error (${res.status})`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(rawText);
  }
};
