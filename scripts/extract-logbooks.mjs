/**
 * scripts/extract-logbooks.mjs
 * High-speed stream-based Excel (.xlsx / .xlsm) Logbook Extractor for PTA Unit 1
 * Reads only XML worksheet/sharedStrings entries from the ZIP central directory,
 * skipping 400+ MB of embedded media/drawings to extract all 9 months (Jan–Oct 2026) in seconds.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { LogbookParser } from '../src/modules/logbook-parser.js';

const WORKSPACE_DIR = process.cwd();
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
  if (!Number.isFinite(num) || num <= 0 || num >= 1) return '';
  const totalMinutes = Math.round(num * 24 * 60);
  const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function openZipIndex(buf) {
  // Locate End of Central Directory (EOCD) signature 0x06054b50
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

  // 2. Map sheet name ("01".."31") -> target XML path via workbook.xml and workbook.xml.rels
  const wbXml = zip.readText('xl/workbook.xml');
  const relsXml = zip.readText('xl/_rels/workbook.xml.rels');

  const relMap = {};
  for (const m of relsXml.matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    let target = m[2].replace(/^\//, '');
    if (!target.startsWith('xl/')) target = `xl/${target}`;
    relMap[m[1]] = target;
  }

  // Also capture state="hidden" if any
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
      if (!body) continue;

      if (!['A', 'B', 'C', 'D', 'E', 'G', 'H', 'I', 'L', 'M', 'N', 'R'].includes(col)) continue;
      if (row > 175) continue;

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

    // Skip unpopulated future template sheets (where neither FM/BM nor production/load is filled properly)
    const hasActivity = Boolean(dayFm || dayBm || nightFm || nightBm);
    if (!hasActivity) continue;

    // Locate dynamic row boundaries for QC and Daily Work
    let qcNightHeaderRow = 20;
    let regularWorkRow = 27;
    let dailyWorkStartRow = 77;
    let steamSepRow = 108;
    let nightDwStartRow = 120;
    let nightDwEndRow = 154;

    for (let r = 12; r <= 170; r++) {
      const aVal = String(cells[`A${r}`] || '').trim();
      const bVal = String(cells[`B${r}`] || '').trim();
      if (r >= 16 && r <= 25 && bVal.toLowerCase() === 'night shift') {
        qcNightHeaderRow = r;
      }
      if (r >= 24 && r <= 35 && aVal.toLowerCase().includes('regular work')) {
        regularWorkRow = r;
      }
      if (r >= 70 && r <= 85 && aVal.toLowerCase() === 'daily work') {
        dailyWorkStartRow = r + 2;
      }
      if (r >= 100 && r <= 130 && bVal.toLowerCase().includes('steam 10s generate')) {
        steamSepRow = r;
      }
      if (r > steamSepRow && r <= steamSepRow + 20 && bVal.includes('K:Link to --> IOW')) {
        nightDwStartRow = r + 1;
      }
      if (r >= nightDwStartRow + 5 && bVal.includes('K:Link to --> IOW')) {
        nightDwEndRow = r - 1;
        break;
      }
    }

    let dayEntryCount = 0;
    let nightEntryCount = 0;

    // Extract QC rows (14 .. regularWorkRow - 1)
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

    // Extract Day Shift Daily Work (dailyWorkStartRow .. steamSepRow - 1)
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

    // Extract Night Shift Daily Work (nightDwStartRow .. nightDwEndRow)
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

    // Only include days that actually have shift logs or real production values
    if (dayEntryCount > 0 || nightEntryCount > 0) {
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
        nightEntryCount
      });
    }
  }

  return { daysSummary, entries };
}

function main() {
  const startTime = Date.now();
  const filesInWorkspace = fs.readdirSync(WORKSPACE_DIR);

  const allMonths = [];
  const allDaysSummary = [];
  const allEntries = [];

  for (const meta of MONTH_FILE_PATTERNS) {
    const matchedFile = filesInWorkspace.find(
      (f) => f.startsWith(meta.prefix) && (f.endsWith('.xlsx') || f.endsWith('.xlsm'))
    );
    if (!matchedFile) continue;

    const fullPath = path.join(WORKSPACE_DIR, matchedFile);
    const t0 = Date.now();
    try {
      const { daysSummary, entries } = parseWorkbookFile(fullPath, meta);
      const elapsed = Date.now() - t0;
      console.log(
        `✅ [${meta.monthKey}] ${matchedFile} -> ${daysSummary.length} days, ${entries.length} log entries (${elapsed} ms)`
      );
      allMonths.push({
        monthKey: meta.monthKey,
        label: meta.label,
        fileName: matchedFile,
        daysCount: daysSummary.length,
        entriesCount: entries.length
      });
      allDaysSummary.push(...daysSummary);
      allEntries.push(...entries);
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
    months: allMonths,
    daysSummary: allDaysSummary,
    entries: allEntries
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2), 'utf8');
  const totalMs = Date.now() - startTime;
  console.log(
    `\n🎉 Extraction complete in ${totalMs} ms! Saved ${allEntries.length} entries across ${allMonths.length} months to public/data/logbook_2026.json`
  );
}

main();
