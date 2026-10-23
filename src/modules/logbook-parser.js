/**
 * LOGBOOK_PARSER — Core Business Logic for PTA1 Logbook Insight & IPS/Kaizen Studio
 * Handles:
 * 1. Equipment & Instrument Tag Extraction (Regex + Normalization)
 * 2. Multi-faceted Smart Log Search & Filtering across Months (Jan–Oct 2026)
 * 3. Monthly & Cross-Month Chronic Equipment Analytics & 4-CBA Target Tracking
 * 4. IPS Benefit Formula 1.1 ((1) + (2) - (4/12) - (5)) & HCL Notes / Kaizen Report Formatting
 */

import { AppConfig } from './app-config.js';

const TAG_REGEX = /\b([A-Z]{2,4})-?(\d{3,4}[A-Z]?)\b/gi;

// Noise prefixes that look like tags in text but aren't plant equipment tags
const IGNORED_PREFIXES = new Set(['DAY', 'OCT', 'SEP', 'AUG', 'JUL', 'JUN', 'MAY', 'APR', 'MAR', 'FEB', 'JAN', 'DEC', 'NOV', 'ROW', 'MIN', 'MAX', 'SEC', 'TON']);

// Noise lines in daily worksheet template that are headers/links rather than actual shift logs
const NOISE_EXACT = new Set([
  'Steam 10S generate',
  'Item',
  'FC-2302.SV',
  'FC2602.MV',
  'K:Link to --> IOW',
  'K:Link to --> ALARM TOP 3',
  'Data EXAPLOG for P#1'
]);

export const LogbookParser = {
  /**
   * Checks if a raw worksheet row text is boilerplate template noise
   * @param {string} text
   * @returns {boolean}
   */
  isNoiseLine(text) {
    if (!text || typeof text !== 'string') return true;
    const trimmed = text.trim();
    if (!trimmed) return true;
    if (NOISE_EXACT.has(trimmed)) return true;
    if (trimmed.startsWith('K:\\PE\\')) return true;
    if (trimmed.startsWith('K:Link to')) return true;
    return false;
  },

  /**
   * Extracts unique, normalized PTA1 equipment/instrument tags from a log line.
   * Also detects key automation keywords like EXAPILOT and RPF.
   * @param {string} text
   * @returns {string[]}
   */
  extractTags(text) {
    if (!text || typeof text !== 'string') return [];
    const seen = new Set();
    const result = [];

    let match;
    TAG_REGEX.lastIndex = 0;
    while ((match = TAG_REGEX.exec(text)) !== null) {
      const prefix = match[1].toUpperCase();
      const numberPart = match[2].toUpperCase();
      if (IGNORED_PREFIXES.has(prefix)) continue;

      const normalized = `${prefix}-${numberPart}`;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }

    if (/\bexapilot\b/i.test(text) && !seen.has('EXAPILOT')) {
      seen.add('EXAPILOT');
      result.push('EXAPILOT');
    }

    if (/\bRPF\b/i.test(text) && !seen.has('PM-401D')) {
      // Tag RPF mentions alongside PM-401D for unified searchability
      if (!seen.has('RPF')) {
        seen.add('RPF');
        result.push('RPF');
      }
    }

    return result;
  },

  /**
   * Filters logbook entries across multiple months using fast criteria matching.
   * @param {Array<Object>} entries
   * @param {Object} filters
   * @returns {Array<Object>}
   */
  filterEntries(entries, filters = {}) {
    if (!Array.isArray(entries)) return [];
    const {
      monthKey = 'ALL',
      shift = 'ALL',
      bm = 'ALL',
      fm = 'ALL',
      category = 'ALL',
      tag = 'ALL',
      query = ''
    } = filters;

    const q = query.trim().toLowerCase();
    const qNoDash = q.replace(/-/g, '');

    return entries.filter((item) => {
      if (monthKey && monthKey !== 'ALL' && item.monthKey !== monthKey) return false;
      if (shift && shift !== 'ALL' && item.shift !== shift) return false;
      if (category && category !== 'ALL' && item.category !== category) return false;

      if (bm && bm !== 'ALL') {
        if (!item.bm || !item.bm.includes(bm)) return false;
      }
      if (fm && fm !== 'ALL') {
        if (!item.fm || !item.fm.includes(fm)) return false;
      }
      if (tag && tag !== 'ALL') {
        if (!Array.isArray(item.tags) || !item.tags.includes(tag.toUpperCase())) return false;
      }

      if (q) {
        const textLower = (item.text || '').toLowerCase();
        const textNoDash = textLower.replace(/-/g, '');
        const tagMatch =
          Array.isArray(item.tags) &&
          item.tags.some((t) => t.toLowerCase().includes(q) || t.toLowerCase().replace(/-/g, '').includes(qNoDash));
        const bmMatch = (item.bm || '').toLowerCase().includes(q);
        const fmMatch = (item.fm || '').toLowerCase().includes(q);
        const dateMatch = `${item.monthKey}-${item.day}`.toLowerCase().includes(q);

        if (!textLower.includes(q) && !textNoDash.includes(qNoDash) && !tagMatch && !bmMatch && !fmMatch && !dateMatch) {
          return false;
        }
      }

      return true;
    });
  },

  /**
   * Filters Silo Operation events (switching & transfer destination).
   * @param {Array<Object>} siloOps
   * @param {Object} filters
   * @returns {Array<Object>}
   */
  filterSiloOperations(siloOps, filters = {}) {
    if (!Array.isArray(siloOps)) return [];
    const { silo = 'ALL', monthKey = 'ALL', query = '' } = filters;
    const q = query.trim().toLowerCase();

    return siloOps.filter((item) => {
      if (monthKey && monthKey !== 'ALL' && item.monthKey !== monthKey) return false;

      if (silo && silo !== 'ALL') {
        const siloUpper = silo.toUpperCase();
        const inSwitch = (item.switchText || '').toUpperCase().includes(siloUpper);
        const inDest = (item.destination || '').toUpperCase().includes(siloUpper);
        const inDesc = (item.description || '').toUpperCase().includes(siloUpper);
        if (!inSwitch && !inDest && !inDesc) return false;
      }

      if (q) {
        const matchSwitch = (item.switchText || '').toLowerCase().includes(q);
        const matchDest = (item.destination || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchDate = (item.date || '').toLowerCase().includes(q);
        if (!matchSwitch && !matchDest && !matchDesc && !matchDate) return false;
      }

      return true;
    });
  },

  /**
   * Filters SAP Work Orders & Handover Memos.
   * @param {Array<Object>} memos
   * @param {Object} filters
   * @returns {Array<Object>}
   */
  filterSapMemos(memos, filters = {}) {
    if (!Array.isArray(memos)) return [];
    const { status = 'ALL', monthKey = 'ALL', query = '' } = filters;
    const q = query.trim().toLowerCase();

    return memos.filter((item) => {
      if (monthKey && monthKey !== 'ALL' && item.monthKey !== monthKey) return false;
      if (status && status !== 'ALL' && (item.status || '').toLowerCase() !== status.toLowerCase()) return false;

      if (q) {
        const matchDetail = (item.detail || '').toLowerCase().includes(q);
        const matchSap = (item.sapNo || '').toLowerCase().includes(q);
        const matchRemark = (item.remark || '').toLowerCase().includes(q);
        const matchDate = (item.date || '').toLowerCase().includes(q);
        if (!matchDetail && !matchSap && !matchRemark && !matchDate) return false;
      }

      return true;
    });
  },

  /**
   * Computes statistical insights from filtered entries and daily summary metrics.
   * @param {Array<Object>} entries
   * @param {Array<Object>} daysSummary
   * @returns {Object}
   */
  computeInsights(entries = [], daysSummary = []) {
    const tagCounts = new Map();
    const tagExamples = new Map();

    for (const entry of entries) {
      if (!Array.isArray(entry.tags)) continue;
      for (const tag of entry.tags) {
        // Skip generic template tags if any slipped through
        if (tag === 'FC-2302' || tag === 'FC-2602') continue;
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        if (!tagExamples.has(tag)) {
          tagExamples.set(tag, entry.text);
        }
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({
        tag,
        count
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

    const tagSamples = Object.fromEntries(tagExamples.entries());

    let cbaExceedCount = 0;
    let cbaSum = 0;
    let cbaCount = 0;
    let prodSum = 0;
    let prodCount = 0;
    const bmShiftCount = {};

    const cbaLimit = AppConfig.TARGETS.CBA_MAX;

    for (const d of daysSummary) {
      if (typeof d.dayCba === 'number' && d.dayCba > 0) {
        cbaSum += d.dayCba;
        cbaCount++;
        if (d.dayCba > cbaLimit) cbaExceedCount++;
      }
      if (typeof d.nightCba === 'number' && d.nightCba > 0) {
        cbaSum += d.nightCba;
        cbaCount++;
        if (d.nightCba > cbaLimit) cbaExceedCount++;
      }
      if (typeof d.prod === 'number' && d.prod > 0) {
        prodSum += d.prod;
        prodCount++;
      }
      if (d.dayBm) {
        const cleanDayBm = d.dayBm.trim().replace(/\s+/g, ' ');
        bmShiftCount[cleanDayBm] = (bmShiftCount[cleanDayBm] || 0) + 1;
      }
      if (d.nightBm) {
        const cleanNightBm = d.nightBm.trim().replace(/\s+/g, ' ');
        bmShiftCount[cleanNightBm] = (bmShiftCount[cleanNightBm] || 0) + 1;
      }
    }

    return {
      totalEntries: entries.length,
      totalDays: daysSummary.length,
      topTags,
      tagSamples,
      cbaExceedCount,
      avgCba: cbaCount > 0 ? Number((cbaSum / cbaCount).toFixed(2)) : 0,
      avgProd: prodCount > 0 ? Number((prodSum / prodCount).toFixed(1)) : 0,
      bmShiftCount
    };
  },

  /**
   * Calculates IPS Section 1.1 Benefit strictly following the HCL Notes formula:
   * Total Monthly = (1) Cost Saving + (2) Man-Hour Saving - (4) Investment/12 - (5) Extra Cost
   * Note: (3) Reduce Opportunity Loss is calculated and displayed separately per form specification.
   * @param {Object} input
   * @returns {Object}
   */
  calculateIpsBenefit(input = {}) {
    const costSaving = Number(input.costSaving) || 0;
    const manHours = Number(input.manHours) || 0;
    const hourlyRate = Number(input.hourlyRate) || 0;
    const oppLossTons = Number(input.oppLossTons) || 0;
    const tonRate = Number(input.tonRate) || 0;
    const investYear = Number(input.investYear) || 0;
    const extraCost = Number(input.extraCost) || 0;

    const manHourSaving = Number((manHours * hourlyRate).toFixed(2));
    const oppLossSaving = Number((oppLossTons * tonRate).toFixed(2));
    const investMonthly = Number((investYear / 12).toFixed(2));

    // Formula in HCL Notes form: 1 + 2 - 4 - 5
    const totalMonthly = Number((costSaving + manHourSaving - investMonthly - extraCost).toFixed(2));

    return {
      costSaving,
      manHours,
      hourlyRate,
      manHourSaving,
      oppLossTons,
      tonRate,
      oppLossSaving,
      investYear,
      investMonthly,
      extraCost,
      totalMonthly
    };
  },

  /**
   * Formats an IPS Draft object into the standard HCL/Lotus Notes ready-to-paste text block.
   * @param {Object} draft
   * @returns {string}
   */
  formatIpsDraft(draft = {}) {
    const calc = this.calculateIpsBenefit(draft.benefitCalc || {});
    const hasBenefitNumbers =
      calc.costSaving > 0 ||
      calc.manHourSaving > 0 ||
      calc.oppLossSaving > 0 ||
      calc.investYear > 0 ||
      calc.extraCost > 0;

    const benefitSection = hasBenefitNumbers
      ? [
          `1. ลดต้นทุนหรือค่าใช้จ่าย (Cost Saving)     = ${calc.costSaving.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท/เดือน`,
          `2. ลด Man-Hour (${calc.manHours} ชม. × ${calc.hourlyRate.toLocaleString('en-US')} บาท/ชม.) = ${calc.manHourSaving.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท/เดือน`,
          `3. ลดโอกาสสูญเสีย (${calc.oppLossTons} ตัน × ${calc.tonRate.toLocaleString('en-US')} บาท/ตัน) = ${calc.oppLossSaving.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท/เดือน`,
          `4. ค่าใช้จ่ายในการลงทุน (${calc.investYear.toLocaleString('en-US')} บาท/ปี ÷ 12) = ${calc.investMonthly.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท/เดือน`,
          `5. ค่าใช้จ่ายที่เพิ่มขึ้น                      = ${calc.extraCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท/เดือน`,
          `───────────────────────────────────`,
          `มูลค่ารวม (สูตร 1+2-4-5) = ${calc.totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2 })} บาท/เดือน`
        ].join('\n')
      : 'ไม่มีข้อมูลยืนยันตัวเลขต้นทุน/Man-Hour (กรอกตัวเลขในช่องคำนวณด้านซ้ายเพื่อคำนวณอัตโนมัติได้ทันทีค่ะ)';

    return [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📋 IPS DRAFT — Individual Kaizen (GC-M PTA)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `🏷️  ชื่องาน (Job name)   : ${draft.jobName || '-'}`,
      `📁  ชื่อเรื่อง (Case name) : ${draft.caseName || '-'}`,
      `🔧  Section แนะนำ        : ${draft.section || 'PE1'} (พี่ A ยืนยัน/เลือกจริงในฟอร์ม)`,
      `🎯  Objective แนะนำ      : ${draft.objective || 'เพิ่ม Reliability'} (คำแนะนำเท่านั้น พี่ A เลือกจริงในฟอร์ม)`,
      `🛠️  Kaizen Way แนะนำ     : ${draft.kaizenWay || '3.Modification'} (คำแนะนำเท่านั้น พี่ A เลือกจริงในฟอร์ม)`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '❌ ก่อนการปรับปรุง (Before improvement)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      draft.beforeText || '-',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '✅ หลังการปรับปรุง (After improvement)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      draft.afterText || '-',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📈 ประสิทธิภาพหลังการปฏิบัติ (Effectiveness after improvement)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      draft.effectText || '-',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '💰 1.1 มูลค่าผลตอบแทน (คำนวณจากตัวเลขที่พี่ A ให้เท่านั้น — ข้ามถ้าไม่มีข้อมูล)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      benefitSection,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n');
  },

  /**
   * Formats a 7-section Kaizen Report Card with Why-Why Analysis.
   * @param {Object} kaizen
   * @returns {string}
   */
  formatKaizenCard(kaizen = {}) {
    return [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '📋 KAIZEN REPORT — GC-M PTA',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `🏷️  ชื่อ Kaizen : ${kaizen.title || kaizen.jobName || '-'}`,
      `📁  ประเภท      : ${kaizen.category || '⚙️ Process Improvement'}`,
      `📅  วันที่       : ${kaizen.date || '-'}`,
      `👤  ผู้เสนอ     : ${kaizen.author || 'Supasit Aoothai'}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '❌ ก่อนทำ (Before)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      kaizen.beforeText || '-',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🔍 Root Cause (Why-Why Analysis)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      kaizen.rootCauseText ||
        [
          `อาการที่พบ: ${kaizen.caseName || '-'}`,
          'Why 1 → เกิดความผิดปกติซ้ำในสภาวะการเดินเครื่องปกติ',
          '  └─ Why 2 → พารามิเตอร์หรือจังหวะการชะล้างเดิมไม่สมดุลกับภาระงานจริง',
          '       └─ Root Cause: ต้องปรับตั้งพารามิเตอร์/ขั้นตอนควบคุมเชิงรุกให้เหมาะสมกับหน้างาน'
        ].join('\n'),
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🔧 แนวทางแก้ไข',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      kaizen.afterText || '-',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '✅ หลังทำ (After) & 💡 Benefit',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      kaizen.effectText || '-',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n');
  },

  /**
   * Automatically builds a ready-to-edit Thai IPS & Kaizen draft from any Logbook entry
   * and its historical occurrences across the plant logbook (works 100% offline without API key).
   * @param {Object} entry
   * @param {Array<Object>} allEntries
   * @returns {Object}
   */
  createDraftFromEntry(entry, allEntries = []) {
    const primaryTag = (entry.tags && entry.tags[0]) || 'Equipment';
    const allTagsStr = (entry.tags && entry.tags.length > 0) ? entry.tags.join(', ') : 'อุปกรณ์ในหน่วยผลิต';
    const related = allEntries.filter(
      (e) => e.id !== entry.id && Array.isArray(e.tags) && e.tags.includes(primaryTag)
    );
    const repeatCount = related.length + 1;

    return {
      id: `draft-${entry.id}-${Date.now()}`,
      sourceId: entry.id,
      date: `${entry.date} (${entry.shift})`,
      tags: entry.tags || [],
      jobName: `การปรับปรุงและแก้ไขปัญหา ${primaryTag} เพื่อรักษาเสถียรภาพการเดินเครื่องหน่วย PTA Unit 1`,
      caseName: `ดำเนินการแก้ไขและควบคุมสภาวะของ ${allTagsStr} (อ้างอิงบันทึกกะ ${entry.date} ${entry.shift})`,
      section: 'PE1',
      objective: 'เพิ่ม Reliability / เพิ่มประสิทธิภาพ(ความสะดวก,ลดเวลาล่าช้า)',
      kaizenWay: '3.Modification',
      beforeText: `จากการติดตามข้อมูลในระบบ Logbook ของหน่วย PTA Unit 1 พบเหตุการณ์เกี่ยวกับ ${allTagsStr} รวม ${repeatCount} ครั้ง โดยในวันที่ ${entry.date} (${entry.shift} Shift) พบสภาวะ: "${entry.text}" ซึ่งหากไม่ดำเนินการควบคุมหรือแก้ไขอย่างทันท่วงที อาจส่งผลกระทบต่อเสถียรภาพของกระบวนการผลิตและเพิ่มภาระงานเฝ้าระวังของ Boardman และ Field Operator`,
      afterText: `Boardman (${entry.bm || 'C ศุภสิทธิ์'}) ร่วมกับทีมงานกะ (${entry.fm || '-'}) ดำเนินการตรวจสอบและปรับแก้สภาวะของ ${allTagsStr} ตามบันทึกการปฏิบัติงาน: "${entry.text}" พร้อมเฝ้าระวังพารามิเตอร์ที่เกี่ยวข้องบนหน้าจอ DCS ให้กลับเข้าสู่ย่านการควบคุมปกติ`,
      effectText: `สภาวะการทำงานของ ${allTagsStr} กลับเข้าสู่สภาวะปกติอย่างปลอดภัย ลดความเสี่ยงต่อการเกิดปัญหาซ้ำซ้อน และช่วยให้การควบคุมคุณภาพผลิตภัณฑ์ (${entry.cba ? `4-CBA = ${entry.cba} ppm, ` : ''}Load = ${entry.load || 100}%) มีความต่อเนื่อง`,
      rootCauseText: [
        `อาการที่พบ: ${entry.text}`,
        `Why 1 → เกิดความคลาดเคลื่อนของสภาวะการทำงานที่อุปกรณ์ ${allTagsStr} (พบประวัติเกี่ยวข้องในระบบรวม ${repeatCount} ครั้ง)`,
        `  └─ Why 2 → สภาวะโหลดหรือการสะสมของ Slurry/คราบตะกรันส่งผลต่ออุปกรณ์ควบคุม`,
        `       └─ Root Cause: ต้องดำเนินการปรับตั้งพารามิเตอร์หรือชะล้างทำความสะอาดเชิงรุกตามเกณฑ์เฝ้าระวังของ Boardman`
      ].join('\n'),
      benefitCalc: {
        costSaving: 0,
        manHours: 2,
        hourlyRate: 0,
        oppLossTons: 0,
        tonRate: 0,
        investYear: 0,
        extraCost: 0
      }
    };
  },

  /**
   * Browser-native high-speed .xlsx / .xlsm parser using DecompressionStream('deflate-raw').
   * Parses 80MB+ workbooks directly in the browser by decompressing only XML worksheets.
   * @param {ArrayBuffer} arrayBuffer
   * @param {string} fileName
   * @returns {Promise<Object>}
   */
  async parseExcelArrayBuffer(arrayBuffer, fileName = 'Uploaded.xlsm') {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);

    let eocd = bytes.length - 22;
    const minSearch = Math.max(0, bytes.length - 65557);
    while (eocd >= minSearch && view.getUint32(eocd, true) !== 0x06054b50) {
      eocd--;
    }
    if (eocd < minSearch) {
      throw new Error('ไฟล์ที่เลือกไม่ใช่ไฟล์ Excel (.xlsx / .xlsm) ที่ถูกต้องค่ะ');
    }

    const cdSize = view.getUint32(eocd + 12, true);
    const cdOffset = view.getUint32(eocd + 16, true);
    let pos = cdOffset;
    const zipEntries = {};
    const decoder = new TextDecoder('utf-8');

    while (pos < cdOffset + cdSize) {
      if (view.getUint32(pos, true) !== 0x02014b50) break;
      const method = view.getUint16(pos + 10, true);
      const compSize = view.getUint32(pos + 20, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localOffset = view.getUint32(pos + 42, true);
      const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
      zipEntries[name] = { method, compSize, localOffset };
      pos += 46 + nameLen + extraLen + commentLen;
    }

    async function readZipText(name) {
      const e = zipEntries[name];
      if (!e) return '';
      const nLen = view.getUint16(e.localOffset + 26, true);
      const exLen = view.getUint16(e.localOffset + 28, true);
      const start = e.localOffset + 30 + nLen + exLen;
      const slice = bytes.subarray(start, start + e.compSize);
      if (e.method === 0) {
        return decoder.decode(slice);
      }
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(slice);
      writer.close();
      const resp = new Response(ds.readable);
      const buf = await resp.arrayBuffer();
      return decoder.decode(buf);
    }

    const decodeEntities = (str) =>
      (str || '')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/_x000D_/g, ' ')
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const monthMatch = fileName.match(/(0?[1-9]|1[0-2])[._\-\s]*([A-Za-z]{3})?.*?(\d{4})/);
    const monthNum = monthMatch ? String(monthMatch[1]).padStart(2, '0') : '11';
    const yearNum = monthMatch ? monthMatch[3] : '2026';
    const monthKey = `${yearNum}-${monthNum}`;
    const thaiMonths = {
      '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.',
      '05': 'พ.ค.', '06': 'มิ.ย.', '07': 'ก.ค.', '08': 'ส.ค.',
      '09': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.'
    };
    const monthLabel = `${thaiMonths[monthNum] || monthNum} ${yearNum}`;

    const ssXml = await readZipText('xl/sharedStrings.xml');
    const sst = [];
    for (const m of ssXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)) {
      let text = '';
      for (const tm of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += tm[1];
      sst.push(decodeEntities(text));
    }

    const wbXml = await readZipText('xl/workbook.xml');
    const relsXml = await readZipText('xl/_rels/workbook.xml.rels');
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
        if (relMap[rId]) daySheets.push({ day: normalizedDay, xmlPath: relMap[rId] });
      }
    }
    daySheets.sort((a, b) => a.day.localeCompare(b.day));

    const daysSummary = [];
    const entries = [];
    const CELL_RE = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

    for (const { day, xmlPath } of daySheets) {
      const sheetXml = await readZipText(xmlPath);
      if (!sheetXml) continue;

      const cells = {};
      for (const m of sheetXml.matchAll(CELL_RE)) {
        const col = m[1];
        const row = parseInt(m[2], 10);
        const attr = m[3];
        const body = m[4];
        if (!body || row > 175) continue;
        if (!['A', 'B', 'C', 'I', 'L', 'M', 'N', 'R'].includes(col)) continue;

        const ism = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
        const vm = body.match(/<v>([\s\S]*?)<\/v>/);
        let val = '';
        if (ism) val = decodeEntities(ism[1]);
        else if (vm) val = /\bt="s"/.test(attr) ? sst[parseInt(vm[1], 10)] || '' : decodeEntities(vm[1]);
        if (val !== '') cells[`${col}${row}`] = val;
      }

      const cleanName = (s) => (s ? String(s).trim().replace(/\s+/g, ' ') : '');
      const toNum = (v, dec = 2) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? Number(n.toFixed(dec)) : 0;
      };

      const dayFm = cleanName(cells.L9);
      const dayBm = cleanName(cells.M9);
      const nightFm = cleanName(cells.L10);
      const nightBm = cleanName(cells.M10);
      if (!dayFm && !dayBm && !nightFm && !nightBm) continue;

      const dayCba = toNum(cells.B9, 2);
      const nightCba = toNum(cells.B10, 2);
      const dayPta = toNum(cells.C9, 1);
      const nightPta = toNum(cells.C10, 1);
      const dayLoad = toNum(cells.I9, 1);
      const nightLoad = toNum(cells.I10, 1);
      const prod = toNum(cells.N22, 1);
      const dp2500 = toNum(cells.R48 || cells.M48, 3);

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

      const pushEntry = (r, shift, category) => {
        const text = String(cells[`B${r}`] || '').trim();
        if (!text || text === '0' || text.startsWith('#') || text.startsWith('Argument is not')) return false;
        if (this.isNoiseLine(text)) return false;
        const isNight = shift === 'Night';
        entries.push({
          id: `${monthKey}-${day}-${isNight ? 'N' : 'D'}-${category}-${r}`,
          monthKey,
          monthLabel,
          date: `${monthKey}-${day}`,
          day,
          shift,
          fm: isNight ? nightFm : dayFm,
          bm: isNight ? nightBm : dayBm,
          cba: isNight ? nightCba : dayCba,
          pta: isNight ? nightPta : dayPta,
          load: isNight ? nightLoad : dayLoad,
          prod,
          dp2500,
          category,
          row: r,
          text,
          tags: this.extractTags(text)
        });
        return true;
      };

      let dCount = 0;
      let nCount = 0;
      for (let r = 14; r < regularWorkRow; r++) {
        if (r === qcNightHeaderRow) continue;
        const isN = r > qcNightHeaderRow;
        if (pushEntry(r, isN ? 'Night' : 'Day', 'QC')) {
          if (isN) nCount++;
          else dCount++;
        }
      }
      for (let r = dailyWorkStartRow; r < steamSepRow; r++) {
        if (pushEntry(r, 'Day', 'DW')) dCount++;
      }
      for (let r = nightDwStartRow; r <= nightDwEndRow; r++) {
        if (pushEntry(r, 'Night', 'DW')) nCount++;
      }

      if (dCount > 0 || nCount > 0) {
        daysSummary.push({
          monthKey,
          monthLabel,
          date: `${monthKey}-${day}`,
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
          dayEntryCount: dCount,
          nightEntryCount: nCount
        });
      }
    }

    return {
      monthMeta: {
        monthKey,
        label: monthLabel,
        fileName,
        daysCount: daysSummary.length,
        entriesCount: entries.length
      },
      daysSummary,
      entries
    };
  }
};
