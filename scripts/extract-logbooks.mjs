/**
 * scripts/extract-logbooks.mjs
 * High-speed stream-based Excel (.xlsx / .xlsm) Logbook Extractor for PTA Unit 1
 * Reads only XML worksheet/sharedStrings entries from the ZIP central directory,
 * skipping 400+ MB of embedded media/drawings to extract all 9 months (Jan–Oct 2026) in seconds.
 *
 * Full Extraction Scope:
 * 1. QC & Shift Daily Work logs
 * 2. 🌾 Silo Operations & Switching Timeline (Silo 800 A/B/C -> PTK810A/B/C / 820A/B + Reasons)
 * 3. 🛠️ SAP Work Orders & Pending Handover Memos
 * 4. 📋 Regular Work & PM Routine Checklist (LCV-2301-3 timings & %, blowdowns, oil draining)
 * 5. 🎯 Silo Destination Matrix & Daily Plan Loading
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { LogbookParser } from '../src/modules/logbook-parser.js';

const WORKSPACE_DIR = process.cwd();
const LOGBOOKS_DIR = fs.existsSync(path.join(WORKSPACE_DIR, 'logbooks'))
  ? path.join(WORKSPACE_DIR, 'logbooks')
  : WORKSPACE_DIR;
const OUTPUT_DIR = path.join(WORKSPACE_DIR, 'public', 'data');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'logbook_2026.json');

const MONTH_FILE_PATTERNS = [
  { monthKey: '2026-01', label: 'ม.ค. 2026', prefix: '01.Jan' },
  { monthKey: '2026-02', label: 'ก.พ. 2026', prefix: '02.Feb' },
  { monthKey: '2026-03', label: 'มี.ค. 2026', prefix: '03.Mar' },
  { monthKey: '2026-04', label: 'เม.ย. 2026', prefix: '04.Apr' },
  { monthKey: '2026-05', label: 'พ.ค. 2026', prefix: '05.May' },
  { monthKey: '2026-06', label: 'มิ.ย. 2026', prefix: '06.Jun' },
  { monthKey: '2026-07', label: 'ก.ค. 2026', prefix: '07.Jul' },
  { monthKey: '2026-08', label: 'ส.ค. 2026', prefix: '08.Aug' },
  { monthKey: '2026-09', label: 'ก.ย. 2026', prefix: '09.Sep' },
  { monthKey: '2026-10', label: 'ต.ค. 2026', prefix: '10.Oct' }
];

function decodeXmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/_x000D_/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatExcelTime(val) {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0 || num >= 1) {
    if (typeof val === 'string' && /^\d{1,2}:\d{2}/.test(val.trim())) return val.trim();
    return '';
  }
  const totalMinutes = Math.round(num * 24 * 60);
  const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function openZipIndex(buf) {
  let eocd = buf.length - 22;
  const minSearch = Math.max(0, buf.length - 65557);
  while (eocd >= minSearch && buf.readUInt32LE(eocd) !== 0x06054b50) {
    eocd--;
  }
  if (eocd < minSearch) {
    throw new Error('ZIP EOCD signature not found');
  }

  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  let pos = cdOffset;
  const entries = {};

  while (pos < cdOffset + cdSize) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    entries[name] = { method, compSize, localOffset };
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return {
    entries,
    readText(name) {
      const e = entries[name];
      if (!e) return '';
      const nLen = buf.readUInt16LE(e.localOffset + 26);
      const exLen = buf.readUInt16LE(e.localOffset + 28);
      const start = e.localOffset + 30 + nLen + exLen;
      const slice = buf.subarray(start, start + e.compSize);
      const raw = e.method === 8 ? zlib.inflateRawSync(slice) : slice;
      return raw.toString('utf8');
    }
  };
}

function parseWorkbookFile(filePath, monthMeta) {
  const buf = fs.readFileSync(filePath);
  const zip = openZipIndex(buf);

  // 1. Parse Shared Strings
  const ssXml = zip.readText('xl/sharedStrings.xml');
  const sst = [];
  for (const m of ssXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)) {
    let text = '';
    for (const tm of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) {
      text += tm[1];
    }
    sst.push(decodeXmlEntities(text));
  }

  // 2. Map sheet name ("01".."31") -> target XML path
  const wbXml = zip.readText('xl/workbook.xml');
  const relsXml = zip.readText('xl/_rels/workbook.xml.rels');

  const relMap = {};
  for (const m of relsXml.matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    let target = m[2].replace(/^\//, '');
    if (!target.startsWith('xl/')) target = `xl/${target}`;
    relMap[m[1]] = target;
  }

  const daySheets = [];
  for (const m of wbXml.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"([^>]*)\/>/g)) {
    const sheetName = m[1].trim();
    const rId = m[2];
    if (/^(0?[1-9]|[12]\d|3[01])$/.test(sheetName)) {
      const normalizedDay = sheetName.padStart(2, '0');
      const xmlPath = relMap[rId];
      if (xmlPath) {
        daySheets.push({ day: normalizedDay, xmlPath });
      }
    }
  }

  daySheets.sort((a, b) => a.day.localeCompare(b.day));

  const daysSummary = [];
  const entries = [];
  const siloOperations = [];
  const sapMemos = [];
  const regularWorkList = [];
  const washingRoutines = [];

  const CELL_RE = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

  for (const { day, xmlPath } of daySheets) {
    const sheetXml = zip.readText(xmlPath);
    if (!sheetXml) continue;

    const cells = {};
    for (const m of sheetXml.matchAll(CELL_RE)) {
      const col = m[1];
      const row = parseInt(m[2], 10);
      const attr = m[3];
      const body = m[4];
      if (!body || row > 175) continue;

      let val = '';
      const ism = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      const vm = body.match(/<v>([\s\S]*?)<\/v>/);
      if (ism) {
        val = decodeXmlEntities(ism[1]);
      } else if (vm) {
        val = /\bt="s"/.test(attr) ? sst[parseInt(vm[1], 10)] || '' : decodeXmlEntities(vm[1]);
      }

      if (val !== '' && val !== undefined) {
        cells[`${col}${row}`] = val;
      }
    }

    const cleanName = (s) => (s ? String(s).trim().replace(/\s+/g, ' ') : '');
    const toNum = (v, decimals = 2) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Number(n.toFixed(decimals)) : 0;
    };

    const dayFm = cleanName(cells.L9);
    const dayBm = cleanName(cells.M9);
    const nightFm = cleanName(cells.L10);
    const nightBm = cleanName(cells.M10);

    const dayCba = toNum(cells.B9, 2);
    const nightCba = toNum(cells.B10, 2);
    const dayPta = toNum(cells.C9, 1);
    const nightPta = toNum(cells.C10, 1);
    const dayLoad = toNum(cells.I9, 1);
    const nightLoad = toNum(cells.I10, 1);
    const prod = toNum(cells.N22, 1);
    const dp2500 = toNum(cells.R48 || cells.M48, 3);

    const hasActivity = Boolean(dayFm || dayBm || nightFm || nightBm);
    if (!hasActivity) continue;

    // Locate dynamic row boundaries
    let qcNightHeaderRow = 20;
    let regularWorkRow = 27;
    let dailyWorkStartRow = 77;
    let steamSepRow = 108;
    let nightDwStartRow = 120;
    let nightDwEndRow = 154;

    for (let r = 12; r <= 170; r++) {
      const aVal = String(cells[`A${r}`] || '').trim();
      const bVal = String(cells[`B${r}`] || '').trim();
      if (r >= 16 && r <= 25 && bVal.toLowerCase() === 'night shift') qcNightHeaderRow = r;
      if (r >= 24 && r <= 35 && aVal.toLowerCase().includes('regular work')) regularWorkRow = r;
      if (r >= 70 && r <= 85 && aVal.toLowerCase() === 'daily work') dailyWorkStartRow = r + 2;
      if (r >= 100 && r <= 130 && bVal.toLowerCase().includes('steam 10s generate')) steamSepRow = r;
      if (r > steamSepRow && r <= steamSepRow + 20 && bVal.includes('K:Link to --> IOW')) nightDwStartRow = r + 1;
      if (r >= nightDwStartRow + 5 && bVal.includes('K:Link to --> IOW')) {
        nightDwEndRow = r - 1;
        break;
      }
    }

    let dayEntryCount = 0;
    let nightEntryCount = 0;

    // 1. QC Rows (14 .. regularWorkRow - 1)
    for (let r = 14; r < regularWorkRow; r++) {
      if (r === qcNightHeaderRow) continue;
      const text = String(cells[`B${r}`] || '').trim();
      if (!text || text === '0' || text.startsWith('#') || text.startsWith('Argument is not')) continue;
      if (LogbookParser.isNoiseLine(text)) continue;

      const isNight = r > qcNightHeaderRow;
      const shift = isNight ? 'Night' : 'Day';
      const fm = isNight ? nightFm : dayFm;
      const bm = isNight ? nightBm : dayBm;
      const cba = isNight ? nightCba : dayCba;
      const pta = isNight ? nightPta : dayPta;
      const load = isNight ? nightLoad : dayLoad;

      if (isNight) nightEntryCount++;
      else dayEntryCount++;

      entries.push({
        id: `${monthMeta.monthKey}-${day}-${isNight ? 'N' : 'D'}-QC-${r}`,
        monthKey: monthMeta.monthKey,
        monthLabel: monthMeta.label,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        shift,
        fm,
        bm,
        cba,
        pta,
        load,
        prod,
        dp2500,
        category: 'QC',
        row: r,
        time: formatExcelTime(cells[`A${r}`]),
        text,
        tags: LogbookParser.extractTags(text)
      });
    }

    // 2. Regular Work (PM Checklist: rows regularWorkRow + 1 .. 38)
    for (let r = regularWorkRow + 1; r <= 38; r++) {
      const task = String(cells[`B${r}`] || '').trim();
      if (!task || task.includes('ดับเบิลคลิก') || task.startsWith('#')) continue;
      const statusNote = String(cells[`N${r}`] || '').trim();
      regularWorkList.push({
        id: `rw-${monthMeta.monthKey}-${day}-${r}`,
        monthKey: monthMeta.monthKey,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        row: r,
        task,
        statusNote,
        isCompleted: statusNote.includes('ทำแล้ว')
      });
    }

    // 3. 🌾 Silo Operations & Switching (rows 50 .. 60)
    for (let r = 50; r <= 60; r++) {
      const timeRaw = cells[`A${r}`];
      const time = formatExcelTime(timeRaw);

      // Silo switching (Cols B, C, D) e.g. "B to A" or "A to B"
      const bPart = String(cells[`B${r}`] || '').trim();
      const cPart = String(cells[`C${r}`] || '').trim();
      const dPart = String(cells[`D${r}`] || '').trim();
      let switchText = '';
      if (bPart && bPart !== 'Silo switching') {
        switchText = [bPart, cPart, dPart].filter(Boolean).join(' ');
      }

      // Destination (Cols E, G, J) e.g. "B to PTK810A" or "A to 820A"
      const ePart = String(cells[`E${r}`] || '').trim();
      const gPart = String(cells[`G${r}`] || '').trim();
      const jPart = String(cells[`J${r}`] || '').trim();
      let destination = '';
      if (ePart && ePart !== 'Destination of silo') {
        destination = [ePart, gPart, jPart].filter(Boolean).join(' ');
      }

      const description = String(cells[`L${r}`] || '').trim();
      if (!switchText && !destination && (!description || description === 'Description')) continue;

      const timeHour = time ? parseInt(time.split(':')[0], 10) : 12;
      const isNight = timeHour >= 20 || timeHour < 8;
      const shift = isNight ? 'Night' : 'Day';
      const bm = isNight ? nightBm : dayBm;
      const fm = isNight ? nightFm : dayFm;

      const siloEvent = {
        id: `silo-${monthMeta.monthKey}-${day}-${r}`,
        monthKey: monthMeta.monthKey,
        monthLabel: monthMeta.label,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        row: r,
        time,
        shift,
        bm,
        fm,
        switchText,
        destination,
        description: description === 'Description' ? '' : description
      };

      siloOperations.push(siloEvent);

      // Make Silo event directly searchable in Timeline
      const summaryText = [
        switchText ? `สลับ Silo: ${switchText}` : '',
        destination ? `ส่ง Silo: ${destination}` : '',
        description && description !== 'Description' ? `(${description})` : ''
      ].filter(Boolean).join(' | ');

      entries.push({
        id: `${monthMeta.monthKey}-${day}-${isNight ? 'N' : 'D'}-SILO-${r}`,
        monthKey: monthMeta.monthKey,
        monthLabel: monthMeta.label,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        shift,
        fm,
        bm,
        cba: isNight ? nightCba : dayCba,
        pta: isNight ? nightPta : dayPta,
        load: isNight ? nightLoad : dayLoad,
        prod,
        dp2500,
        category: 'SILO',
        row: r,
        time,
        text: `[🌾 Silo Operation] ${summaryText}`,
        tags: LogbookParser.extractTags(summaryText)
      });
    }

    // 4. 🛠️ SAP / MT Work & Handover Memos (rows 62 .. 74)
    for (let r = 62; r <= 74; r++) {
      const sapNo = String(cells[`A${r}`] || '').trim();
      const detail = String(cells[`C${r}`] || cells[`B${r}`] || '').trim();
      const status = String(cells[`N${r}`] || cells[`O${r}`] || '').trim();
      const remark = String(cells[`Q${r}`] || cells[`R${r}`] || '').trim();

      if (!detail && !sapNo) continue;
      if (sapNo === 'SAP No.' || detail === 'Detail' || detail.startsWith('Total')) continue;

      const sapItem = {
        id: `sap-${monthMeta.monthKey}-${day}-${r}`,
        monthKey: monthMeta.monthKey,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        row: r,
        sapNo: sapNo === 'SAP No.' ? '' : sapNo,
        detail,
        status,
        remark
      };

      sapMemos.push(sapItem);

      // Also make SAP Memos directly searchable in Timeline
      entries.push({
        id: `${monthMeta.monthKey}-${day}-D-SAP-${r}`,
        monthKey: monthMeta.monthKey,
        monthLabel: monthMeta.label,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        shift: 'Day',
        fm: dayFm,
        bm: dayBm,
        cba: dayCba,
        pta: dayPta,
        load: dayLoad,
        prod,
        dp2500,
        category: 'SAP',
        row: r,
        time: '',
        text: `[🛠️ SAP/Handover] ${sapNo ? `SAP #${sapNo} ` : ''}${detail} ${status ? `[สถานะ: ${status}]` : ''}`,
        tags: LogbookParser.extractTags(detail)
      });
    }

    // 5. Day Shift Daily Work (dailyWorkStartRow .. steamSepRow - 1)
    for (let r = dailyWorkStartRow; r < steamSepRow; r++) {
      const text = String(cells[`B${r}`] || '').trim();
      if (!text || text === '0' || text.startsWith('#') || text.startsWith('Argument is not')) continue;
      if (LogbookParser.isNoiseLine(text)) continue;

      dayEntryCount++;
      entries.push({
        id: `${monthMeta.monthKey}-${day}-D-DW-${r}`,
        monthKey: monthMeta.monthKey,
        monthLabel: monthMeta.label,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        shift: 'Day',
        fm: dayFm,
        bm: dayBm,
        cba: dayCba,
        pta: dayPta,
        load: dayLoad,
        prod,
        dp2500,
        category: 'DW',
        row: r,
        time: formatExcelTime(cells[`A${r}`]),
        text,
        tags: LogbookParser.extractTags(text)
      });
    }

    // 6. Night Shift Daily Work (nightDwStartRow .. nightDwEndRow)
    for (let r = nightDwStartRow; r <= nightDwEndRow; r++) {
      const text = String(cells[`B${r}`] || '').trim();
      if (!text || text === '0' || text.startsWith('#') || text.startsWith('Argument is not')) continue;
      if (LogbookParser.isNoiseLine(text)) continue;

      nightEntryCount++;
      entries.push({
        id: `${monthMeta.monthKey}-${day}-N-DW-${r}`,
        monthKey: monthMeta.monthKey,
        monthLabel: monthMeta.label,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        shift: 'Night',
        fm: nightFm,
        bm: nightBm,
        cba: nightCba,
        pta: nightPta,
        load: nightLoad,
        prod,
        dp2500,
        category: 'DW',
        row: r,
        time: formatExcelTime(cells[`A${r}`]),
        text,
        tags: LogbookParser.extractTags(text)
      });
    }

    // 7. 🧼 PM-901 High Pressure & Chemical Washing Routine (Day: 100..130, Night: 140..170)
    const extractShiftWashing = (startRow, endRow, meta) => {
      let pm901Row = -1;
      for (let r = startRow; r <= endRow; r++) {
        const txt = cells[`L${r}`] || '';
        if (txt.includes('PM-901 high pressure')) {
          pm901Row = r;
          break;
        }
      }
      if (pm901Row === -1) return null;

      const rawHp = cells[`L${pm901Row}`] || '';
      let hpTime = '';
      const hpMatch = rawHp.match(/(\d{1,2}[:.]\d{2})/);
      if (hpMatch) hpTime = hpMatch[1].replace('.', ':');

      let rawBatch = '';
      for (let r = pm901Row + 1; r <= pm901Row + 3; r++) {
        const txt = cells[`L${r}`] || '';
        if (txt.includes('Batch') || txt.includes('Total #')) {
          rawBatch = txt;
          break;
        }
      }

      let washNo = '';
      const suffixNoMatch = rawBatch.match(/No\.?\s*(\d+)/i);
      const prefixNoMatch = rawBatch.match(/^\s*(\d+)\s+Total/i);
      if (suffixNoMatch && suffixNoMatch[1]) washNo = suffixNoMatch[1];
      else if (prefixNoMatch && prefixNoMatch[1]) washNo = prefixNoMatch[1];

      let batchCount = null;
      const batchMatch = rawBatch.match(/Total\s*#\s*[_ ]*(\d+)[_ ]*;?\s*Batch/i) || rawBatch.match(/[_ ]*(\d+)[_ ]*;?\s*Batch/i);
      if (batchMatch && batchMatch[1]) {
        batchCount = parseInt(batchMatch[1], 10);
      }

      let naohMlLine = '';
      let naohPj404 = '';
      let pp404Target = '';
      let pp404Time = '';
      let naohPm901Time = '';
      let pm901StartTime = '';
      let naohLi2901 = false;
      let requestCta = '';

      for (let r = pm901Row + 1; r <= endRow; r++) {
        const lVal = cells[`L${r}`] || '';
        const oVal = cells[`O${r}`] || '';
        const pVal = cells[`P${r}`] || '';

        if (lVal.includes('ML line to PD-403')) {
          const tMatch = lVal.match(/(\d{1,2}[:.]\d{2})/);
          naohMlLine = tMatch ? tMatch[1].replace('.', ':') : 'Yes';
        }
        if (lVal.includes('PJ-404')) {
          const tMatch = lVal.match(/(\d{1,2}[:.]\d{2})/);
          naohPj404 = tMatch ? tMatch[1].replace('.', ':') : (oVal.includes('Yes') ? 'Yes' : '');
        }
        if (lVal.includes('PP-404 to PW-901') || lVal.includes('@ PP-404')) {
          const tMatch = lVal.match(/(\d{1,2}[:.]\d{2})/);
          if (tMatch && !pp404Time) pp404Time = tMatch[1].replace('.', ':');
          const targetMatch = lVal.match(/PP-404\s*["']?([AB])["']?/i);
          if (targetMatch) pp404Target = `PP-404${targetMatch[1].toUpperCase()}`;
        }
        if (lVal.includes('LI-2901')) {
          if (lVal.match(/\d{1,2}[:.]\d{2}/) || oVal.includes('Yes')) naohLi2901 = true;
        }
        if (lVal.includes('NaOH washing PM-901')) {
          const tMatch = lVal.match(/(\d{1,2}[:.]\d{2})/);
          if (tMatch) naohPm901Time = tMatch[1].replace('.', ':');
        }
        if (lVal.includes('Start PM-901 operation')) {
          const tMatch = lVal.match(/(\d{1,2}[:.]\d{2})/);
          if (tMatch) pm901StartTime = tMatch[1].replace('.', ':');
        }
        if (lVal.includes('Request CTA unit prepare 4% NaOH')) {
          requestCta = (pVal && pVal.toLowerCase() === 'no') ? 'No' : (oVal && oVal.toLowerCase() === 'yes' ? 'Yes' : '');
        }
      }

      const hasWashing = Boolean(hpTime || washNo || batchCount != null || pp404Target || naohPm901Time || pm901StartTime);
      if (!hasWashing) return null;

      const durationMin = LogbookParser.calculateWashingDuration(hpTime || naohPm901Time, pm901StartTime);

      return {
        ...meta,
        hpTime,
        washNo: washNo ? `No. ${washNo}` : '-',
        washNoNum: washNo ? parseInt(washNo, 10) : null,
        batchCount,
        naohMlLine,
        naohPj404,
        pp404Target: pp404Target || '-',
        pp404Time,
        naohPm901Time,
        pm901StartTime,
        durationMin,
        naohLi2901,
        requestCta
      };
    };

    // Day Shift Washing Routine
    const dayWash = extractShiftWashing(100, 130, {
      id: `wash-${monthMeta.monthKey}-${day}-D`,
      monthKey: monthMeta.monthKey,
      date: `${monthMeta.monthKey}-${day}`,
      day,
      shift: 'Day',
      bm: dayBm,
      fm: dayFm
    });
    if (dayWash) {
      washingRoutines.push(dayWash);
      const summaryText = [
        `[🧼 Routine ล้าง PM-901 & สารเคมี]`,
        dayWash.washNo !== '-' ? `รอบ ${dayWash.washNo}` : '',
        dayWash.batchCount != null ? `(${dayWash.batchCount} Batch)` : '',
        dayWash.hpTime ? `High Pressure @ ${dayWash.hpTime}` : '',
        dayWash.pp404Target !== '-' ? `ล้าง ${dayWash.pp404Target}${dayWash.pp404Time ? ` @ ${dayWash.pp404Time}` : ''}` : '',
        dayWash.naohPj404 ? `ล้าง PJ-404 ${dayWash.naohPj404}` : '',
        dayWash.naohPm901Time ? `ล้าง PM-901 @ ${dayWash.naohPm901Time}` : '',
        dayWash.pm901StartTime ? `Start PM-901 @ ${dayWash.pm901StartTime}` : '',
        dayWash.durationMin > 0 ? `(รวมหยุด ${LogbookParser.formatDurationMinutes(dayWash.durationMin)})` : ''
      ].filter(Boolean).join(' ');

      const washTags = ['PM-901', 'WASHING'];
      if (dayWash.pp404Target !== '-') washTags.push(dayWash.pp404Target);
      if (dayWash.naohPj404) washTags.push('PJ-404');
      if (dayWash.naohLi2901) washTags.push('LI-2901');

      entries.push({
        id: `${monthMeta.monthKey}-${day}-D-WASH`,
        monthKey: monthMeta.monthKey,
        monthLabel: monthMeta.label,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        shift: 'Day',
        fm: dayFm,
        bm: dayBm,
        cba: dayCba,
        pta: dayPta,
        load: dayLoad,
        prod,
        dp2500,
        category: 'WASH',
        row: 108,
        time: dayWash.hpTime || dayWash.naohPm901Time || '',
        text: summaryText,
        tags: washTags
      });
    }

    // Night Shift Washing Routine
    const nightWash = extractShiftWashing(140, 170, {
      id: `wash-${monthMeta.monthKey}-${day}-N`,
      monthKey: monthMeta.monthKey,
      date: `${monthMeta.monthKey}-${day}`,
      day,
      shift: 'Night',
      bm: nightBm,
      fm: nightFm
    });
    if (nightWash) {
      washingRoutines.push(nightWash);
      const summaryText = [
        `[🧼 Routine ล้าง PM-901 & สารเคมี]`,
        nightWash.washNo !== '-' ? `รอบ ${nightWash.washNo}` : '',
        nightWash.batchCount != null ? `(${nightWash.batchCount} Batch)` : '',
        nightWash.hpTime ? `High Pressure @ ${nightWash.hpTime}` : '',
        nightWash.pp404Target !== '-' ? `ล้าง ${nightWash.pp404Target}${nightWash.pp404Time ? ` @ ${nightWash.pp404Time}` : ''}` : '',
        nightWash.naohPj404 ? `ล้าง PJ-404 ${nightWash.naohPj404}` : '',
        nightWash.naohPm901Time ? `ล้าง PM-901 @ ${nightWash.naohPm901Time}` : '',
        nightWash.pm901StartTime ? `Start PM-901 @ ${nightWash.pm901StartTime}` : '',
        nightWash.durationMin > 0 ? `(รวมหยุด ${LogbookParser.formatDurationMinutes(nightWash.durationMin)})` : ''
      ].filter(Boolean).join(' ');

      const washTags = ['PM-901', 'WASHING'];
      if (nightWash.pp404Target !== '-') washTags.push(nightWash.pp404Target);
      if (nightWash.naohPj404) washTags.push('PJ-404');
      if (nightWash.naohLi2901) washTags.push('LI-2901');

      entries.push({
        id: `${monthMeta.monthKey}-${day}-N-WASH`,
        monthKey: monthMeta.monthKey,
        monthLabel: monthMeta.label,
        date: `${monthMeta.monthKey}-${day}`,
        day,
        shift: 'Night',
        fm: nightFm,
        bm: nightBm,
        cba: nightCba,
        pta: nightPta,
        load: nightLoad,
        prod,
        dp2500,
        category: 'WASH',
        row: 149,
        time: nightWash.hpTime || nightWash.naohPm901Time || '',
        text: summaryText,
        tags: washTags
      });
    }

    // Days summary record
    daysSummary.push({
      monthKey: monthMeta.monthKey,
      monthLabel: monthMeta.label,
      date: `${monthMeta.monthKey}-${day}`,
      day,
      dayFm,
      dayBm,
      nightFm,
      nightBm,
      dayCba,
      nightCba,
      dayPta,
      nightPta,
      dayLoad,
      nightLoad,
      prod,
      dp2500,
      dayEntryCount,
      nightEntryCount,
      siloMatrix: {
        ptk810a: cells.AB17 || '',
        ptk810b: cells.AB18 || '',
        ptk810c: cells.AB19 || '',
        ttk401: cells.AB20 || '',
        planLoading810A: cells.P28 || '',
        planLoading820A: cells.P30 || ''
      }
    });
  }

  return { daysSummary, entries, siloOperations, sapMemos, regularWorkList, washingRoutines };
}

function main() {
  const startTime = Date.now();
  const filesInLogbooks = fs.existsSync(LOGBOOKS_DIR) ? fs.readdirSync(LOGBOOKS_DIR) : [];
  const filesInWorkspace = fs.existsSync(WORKSPACE_DIR) ? fs.readdirSync(WORKSPACE_DIR) : [];
  const searchFiles = [...new Set([...filesInLogbooks, ...filesInWorkspace])];

  const allMonths = [];
  const allDaysSummary = [];
  const allEntries = [];
  const allSiloOperations = [];
  const allSapMemos = [];
  const allRegularWork = [];
  const allWashingRoutines = [];

  for (const meta of MONTH_FILE_PATTERNS) {
    const matchedFile = searchFiles.find(
      (f) => f.startsWith(meta.prefix) && (f.endsWith('.xlsx') || f.endsWith('.xlsm'))
    );
    if (!matchedFile) continue;

    const fullPath = fs.existsSync(path.join(LOGBOOKS_DIR, matchedFile))
      ? path.join(LOGBOOKS_DIR, matchedFile)
      : path.join(WORKSPACE_DIR, matchedFile);
    const t0 = Date.now();
    try {
      const { daysSummary, entries, siloOperations, sapMemos, regularWorkList, washingRoutines } = parseWorkbookFile(fullPath, meta);
      const elapsed = Date.now() - t0;
      console.log(
        `✅ [${meta.monthKey}] ${matchedFile} -> ${daysSummary.length} วัน, ${entries.length} บันทึก, Silo: ${siloOperations.length}, SAP: ${sapMemos.length}, ล้าง: ${washingRoutines.length} (${elapsed} ms)`
      );
      allMonths.push({
        monthKey: meta.monthKey,
        label: meta.label,
        fileName: matchedFile,
        daysCount: daysSummary.length,
        entriesCount: entries.length,
        siloCount: siloOperations.length,
        sapCount: sapMemos.length,
        washingCount: washingRoutines.length
      });
      allDaysSummary.push(...daysSummary);
      allEntries.push(...entries);
      allSiloOperations.push(...siloOperations);
      allSapMemos.push(...sapMemos);
      allRegularWork.push(...regularWorkList);
      allWashingRoutines.push(...washingRoutines);
    } catch (err) {
      console.error(`❌ Failed to parse ${matchedFile}:`, err.message);
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    totalMonths: allMonths.length,
    totalDays: allDaysSummary.length,
    totalEntries: allEntries.length,
    totalSiloOperations: allSiloOperations.length,
    totalSapMemos: allSapMemos.length,
    totalRegularWork: allRegularWork.length,
    totalWashingRoutines: allWashingRoutines.length,
    months: allMonths,
    daysSummary: allDaysSummary,
    entries: allEntries,
    siloOperations: allSiloOperations,
    sapMemos: allSapMemos,
    regularWork: allRegularWork,
    washingRoutines: allWashingRoutines
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2), 'utf8');
  const totalMs = Date.now() - startTime;
  console.log(
    `\n🎉 Comprehensive Extraction complete in ${totalMs} ms!\n` +
    `• รวม ${allMonths.length} เดือน (${allDaysSummary.length} วันทำการ)\n` +
    `• รายการบันทึกหน้างานทั้งหมด: ${allEntries.length.toLocaleString('en-US')} รายการ\n` +
    `• 🌾 ข้อมูล Silo Switching & Logistics: ${allSiloOperations.length.toLocaleString('en-US')} รายการ\n` +
    `• 🧼 ข้อมูล Routine ล้าง PM-901 & สารเคมี: ${allWashingRoutines.length.toLocaleString('en-US')} รายการ\n` +
    `• 🛠️ ข้อมูลงานแจ้งซ่อม SAP & Memo ค้างส่งเวร: ${allSapMemos.length.toLocaleString('en-US')} รายการ\n` +
    `• 📋 งานตรวจเช็ก Regular Work / PM: ${allRegularWork.length.toLocaleString('en-US')} รายการ\n` +
    `บันทึกสู่ public/data/logbook_2026.json เรียบร้อยค่ะ!`
  );
}

main();
