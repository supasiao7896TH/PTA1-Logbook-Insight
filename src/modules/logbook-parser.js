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

export const SYMPTOM_MATCHERS = {
  HUNTING: [/\bhunting\b/i, /\bswing\b/i, /\boscillat\b/i, /mv\s*(up|100%|high)/i, /แกว่ง/i, /ไม่นิ่ง/i],
  CLOGGED: [/high\s*dp/i, /dp\s*high/i, /\bclog\b/i, /\bfoul\b/i, /\bblock\b/i, /\bwash/i, /\bnaoh\b/i, /ตัน/i, /ล้าง/i, /ตะกรัน/i],
  ALARM: [/\balarm\b/i, /\bhigh\b/i, /\blow\b/i, /\bexceed\b/i, /\bspike\b/i, /เตือน/i, /สูง/i, /ต่ำ/i],
  TRIP: [/\btrip\b/i, /\bcut\b/i, /\binterlock\b/i, /\bstop\b/i, /\bshutdown\b/i, /\bfail\b/i, /ตัด/i, /หยุด/i],
  LEAK: [/\bleak\b/i, /\bpassing\b/i, /\bgland\b/i, /\bpacking\b/i, /\bseal\b/i, /\bdrain\b/i, /\bblowdown\b/i, /รั่ว/i, /ซึม/i],
  EXAPILOT: [/\bexapilot\b/i, /\bsequence\b/i, /\bauto\b/i]
};

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
      query = '',
      symptomCategory = 'ALL'
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

      if (symptomCategory && symptomCategory !== 'ALL') {
        const patterns = SYMPTOM_MATCHERS[symptomCategory];
        if (patterns && !patterns.some((p) => p.test(item.text || ''))) {
          return false;
        }
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
   * Filters PM-901 High Pressure & Chemical Washing Routine events.
   * @param {Array<Object>} washingRoutines
   * @param {Object} filters
   * @returns {Array<Object>}
   */
  filterWashingRoutines(washingRoutines, filters = {}) {
    if (!Array.isArray(washingRoutines)) return [];
    const { equipment = 'ALL', washNo = 'ALL', monthKey = 'ALL', query = '' } = filters;
    const q = query.trim().toLowerCase();

    return washingRoutines.filter((item) => {
      if (monthKey && monthKey !== 'ALL' && item.monthKey !== monthKey) return false;

      // Filter by washNo (e.g. "No. 2" or "2")
      if (washNo && washNo !== 'ALL') {
        const targetNo = String(washNo).replace(/[^0-9]/g, '');
        const itemNo = String(item.washNo || '').replace(/[^0-9]/g, '');
        if (targetNo !== itemNo) return false;
      }

      // Filter by equipment (PP-404A, PP-404B, PJ-404, PM-901, LI-2901)
      if (equipment && equipment !== 'ALL') {
        const eq = equipment.toUpperCase();
        if (eq === 'PP-404A') {
          const target = (item.pp404Target || '').toUpperCase();
          if (!target.includes('PP-404A') && target !== 'A') return false;
        } else if (eq === 'PP-404B') {
          const target = (item.pp404Target || '').toUpperCase();
          if (!target.includes('PP-404B') && target !== 'B') return false;
        } else if (eq === 'PJ-404') {
          if (!item.naohPj404 || item.naohPj404 === '-' || item.naohPj404 === 'No') return false;
        } else if (eq === 'PM-901') {
          if (!item.hpTime && !item.naohPm901Time && !item.pm901StartTime) return false;
        } else if (eq === 'LI-2901') {
          if (!item.naohLi2901) return false;
        }
      }

      // Text query search
      if (q) {
        const matchBm = (item.bm || '').toLowerCase().includes(q);
        const matchFm = (item.fm || '').toLowerCase().includes(q);
        const matchBatch = item.batchCount != null && String(item.batchCount).includes(q);
        const matchDate = (item.date || '').toLowerCase().includes(q);
        const matchWashNo = (item.washNo || '').toLowerCase().includes(q);
        const matchPp404 = (item.pp404Target || '').toLowerCase().includes(q);
        if (!matchBm && !matchFm && !matchBatch && !matchDate && !matchWashNo && !matchPp404) return false;
      }

      return true;
    });
  },

  /**
   * Filters Regular Work Routine events.
   * @param {Array<Object>} regularWorkRoutines
   * @param {Object} filters
   * @returns {Array<Object>}
   */
  filterRegularWorkRoutines(regularWorkRoutines, filters = {}) {
    if (!Array.isArray(regularWorkRoutines)) return [];
    const { taskKey = 'ALL', monthKey = 'ALL', query = '' } = filters;
    const q = query.trim().toLowerCase();

    return regularWorkRoutines.filter((item) => {
      if (monthKey && monthKey !== 'ALL' && item.monthKey !== monthKey) return false;

      if (taskKey && taskKey !== 'ALL') {
        if ((item.taskKey || '').toUpperCase() !== taskKey.toUpperCase()) return false;
      }

      if (q) {
        const matchTitle = (item.taskTitle || '').toLowerCase().includes(q);
        const matchVal = (item.valueDetail || '').toLowerCase().includes(q);
        const matchNote = (item.note || '').toLowerCase().includes(q);
        const matchBm = (item.bm || '').toLowerCase().includes(q);
        const matchFm = (item.fm || '').toLowerCase().includes(q);
        const matchDate = (item.date || '').toLowerCase().includes(q);
        const matchKey = (item.taskKey || '').toLowerCase().includes(q);
        if (!matchTitle && !matchVal && !matchNote && !matchBm && !matchFm && !matchDate && !matchKey) return false;
      }

      return true;
    });
  },

  /**
   * Checks whether a filename should be ignored by the Logbook sync watcher
   * (e.g. temporary Excel lock files "~$*.xlsx", temp files, hidden OS files).
   * @param {string} filename
   * @returns {boolean}
   */
  isIgnoredLogbookFile(filename) {
    if (!filename || typeof filename !== 'string') return true;
    const base = filename.trim().split(/[\\/]/).pop();
    if (!base) return true;
    if (base.startsWith('~$')) return true; // Excel temporary lock file
    if (base.startsWith('.')) return true; // Hidden files (.DS_Store, etc.)
    if (base.endsWith('.tmp') || base.endsWith('.crdownload') || base === 'Thumbs.db') return true;
    return false;
  },

  /**
   * Compares two ISO timestamps to determine if incomingTimestamp is strictly newer than currentTimestamp.
   * @param {string|null} currentTimestamp
   * @param {string|null} incomingTimestamp
   * @returns {boolean}
   */
  isNewerTimestamp(currentTimestamp, incomingTimestamp) {
    if (!incomingTimestamp) return false;
    if (!currentTimestamp) return true;
    const tCur = new Date(currentTimestamp).getTime();
    const tInc = new Date(incomingTimestamp).getTime();
    if (Number.isNaN(tInc)) return false;
    if (Number.isNaN(tCur)) return true;
    return tInc > tCur;
  },

  /**
   * Calculates continuous 24-hr plant operational timeline minute from the 07:30 shift start.
   * Day Shift: 07:30 to 19:30 (minute 0 .. 720)
   * Night Shift: 19:30 to 07:30 next morning (minute 720 .. 1440)
   * @param {string} shift 'Day' | 'Night'
   * @param {string} time e.g. "07:48", "11:36", "21:00", "00:16"
   * @param {number} row optional Excel row for tie-breaking
   * @returns {number} continuous timeline minute
   */
  getShiftTimelineMinute(shift, time, row = 0) {
    const isNight = shift === 'Night';
    const rowOffset = Number(row || 0) * 0.0001;
    const SHIFT_START_MINUTES = 7 * 60 + 30; // 07:30 = 450 minutes from 00:00

    if (!time || typeof time !== 'string' || !time.includes(':')) {
      return isNight ? 720 + rowOffset : 0 + rowOffset;
    }

    const parts = time.trim().split(/[:.]/);
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      return isNight ? 720 + rowOffset : 0 + rowOffset;
    }

    if (isNight) {
      // Night shift: 19:30 - 23:59 (evening) or 00:00 - 07:30 (past midnight)
      let adjustedH = h;
      if (h < 12) {
        adjustedH = h + 24; // e.g. 00:16 -> 24:16, 06:00 -> 30:00
      }
      const rawMin = adjustedH * 60 + m - SHIFT_START_MINUTES;
      return Math.max(720, Math.min(1440, rawMin)) + rowOffset;
    } else {
      // Day shift: 07:30 - 19:30
      let rawMin = h * 60 + m - SHIFT_START_MINUTES;
      if (rawMin < 0) rawMin = 0; // Handover before 07:30
      return Math.min(720, rawMin) + rowOffset;
    }
  },

  /**
   * Compares two log entries chronologically according to GC-M PTA plant shift timeline.
   * @param {Object} a
   * @param {Object} b
   * @param {'desc'|'asc'} sortOrder 'desc' (newest first) or 'asc' (chronological)
   * @returns {number}
   */
  compareLogChronology(a, b, sortOrder = 'desc') {
    const dateA = a.date || '';
    const dateB = b.date || '';

    if (dateA !== dateB) {
      return sortOrder === 'desc'
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    }

    const minA = this.getShiftTimelineMinute(a.shift, a.time, a.row);
    const minB = this.getShiftTimelineMinute(b.shift, b.time, b.row);

    if (minA !== minB) {
      return sortOrder === 'desc' ? minB - minA : minA - minB;
    }

    return (a.row || 0) - (b.row || 0);
  },

  /**
   * Calculates duration in minutes between start time and end time (handling midnight crossing).
   * @param {string} startTime e.g. "13:40"
   * @param {string} endTime e.g. "15:44"
   * @returns {number} duration in minutes
   */
  calculateWashingDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const parseM = (t) => {
      const parts = String(t).trim().split(/[:.]/);
      if (parts.length < 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
    };
    const s = parseM(startTime);
    const e = parseM(endTime);
    if (s === null || e === null) return 0;
    let diff = e - s;
    if (diff < 0) diff += 24 * 60; // crossed midnight!
    return diff;
  },

  /**
   * Formats duration in minutes into a Thai friendly string (e.g. "2 ชม. 4 นาที").
   * @param {number} totalMinutes
   * @returns {string}
   */
  formatDurationMinutes(totalMinutes) {
    if (!totalMinutes || totalMinutes <= 0) return '-';
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs > 0 && mins > 0) return `${hrs} ชม. ${mins} นาที`;
    if (hrs > 0) return `${hrs} ชม.`;
    return `${mins} นาที`;
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
  },

  detectPlantUnit(tag) {
    const t = (tag || '').toUpperCase();
    if (/^(PM-4|PP-4|PJ-4|ACV-|XV-4|FCV-4|PCV-4|TI-4|PI-4|TCV-4|LCV-4|PM-405|PP-405|PM-6|PP-6|PD-6|PZ-6|REACTOR|OXIDATION)/i.test(t)) {
      return 'Reaction';
    }
    if (/^(LCV-2|LC-2|PCV-2|PC-2|FCV-2|FC-2|TI-2|PI-2|TCV-2|PM-5|PP-5|PD-40|PD-25|PT-5|PM-9|PW-9|RPF|CENTRIFUGE|DRYER|PURIFICATION)/i.test(t)) {
      return 'Purification';
    }
    if (/^(TTK-4|PTK-8|810|820|SILO|TRANSFER|BLOWER)/i.test(t)) {
      return 'Silo';
    }
    if (/^(STEAM|AIR|COOLING|CONDENSATE|WASTE|FLARE|WWTP|UTILITY)/i.test(t)) {
      return 'Utilities';
    }
    return 'Other';
  },

  computeParetoBadActors(entries = [], options = {}) {
    if (!Array.isArray(entries)) entries = [];
    const {
      sapMemos = [],
      minIncidents = 1,
      unitFilter = 'ALL',
      monthKey = 'ALL',
      query = '',
      referenceDate = null
    } = options;

    const q = query.trim().toLowerCase();

    // 1. Gather all equipment tag occurrences
    const tagMap = new Map();
    let maxDateOverall = '2026-01-01';

    for (const e of entries) {
      if (monthKey && monthKey !== 'ALL' && e.monthKey !== monthKey) continue;
      const tags = Array.isArray(e.tags) ? e.tags : [];
      const entryDate = e.date || '';
      if (entryDate > maxDateOverall) maxDateOverall = entryDate;

      for (const rawTag of tags) {
        const tag = rawTag.trim();
        if (!tag || tag === 'EXAPILOT') continue; // Skip generic meta keywords

        if (!tagMap.has(tag)) {
          tagMap.set(tag, {
            tag,
            unit: this.detectPlantUnit(tag),
            count: 0,
            dates: [],
            samples: []
          });
        }

        const record = tagMap.get(tag);
        record.count++;
        if (entryDate) record.dates.push(entryDate);
        if (record.samples.length < 3 && e.text) {
          record.samples.push(e.text);
        }
      }
    }

    const refDate = referenceDate || maxDateOverall;

    // 2. Sort tags descending by count
    const allTags = Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
    const totalIncidents = allTags.reduce((acc, cur) => acc + cur.count, 0);

    // 3. Compute Pareto cumulative % and intervals
    let cumulativeCount = 0;
    let crossedPareto80 = false;
    const computedItems = [];

    for (const item of allTags) {
      const percentage = totalIncidents > 0 ? Number(((item.count / totalIncidents) * 100).toFixed(1)) : 0;
      cumulativeCount += item.count;
      const cumulativePercentage = totalIncidents > 0 ? Number(((cumulativeCount / totalIncidents) * 100).toFixed(1)) : 0;

      // Determine Pareto 80 cutoff
      let isPareto80 = false;
      if (!crossedPareto80) {
        isPareto80 = true;
        if (cumulativePercentage >= 80) {
          crossedPareto80 = true;
        }
      }

      // Sort dates
      const sortedDates = [...item.dates].sort();
      const firstSeen = sortedDates[0] || '';
      const lastSeen = sortedDates[sortedDates.length - 1] || '';

      // Days between first and last incident
      let avgDaysBetween = 0;
      if (item.count > 1 && firstSeen && lastSeen) {
        const diffMs = new Date(lastSeen) - new Date(firstSeen);
        const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        avgDaysBetween = Number((diffDays / (item.count - 1)).toFixed(1));
      }

      // Days since last incident
      let daysSinceLast = 0;
      if (lastSeen && refDate) {
        const diffMs = new Date(refDate) - new Date(lastSeen);
        daysSinceLast = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }

      // Trend calculation
      let trend = 'Stable';
      if (item.count >= 3 && sortedDates.length >= 3) {
        const lastTwoDiff = (new Date(sortedDates[sortedDates.length - 1]) - new Date(sortedDates[sortedDates.length - 2])) / (1000 * 60 * 60 * 24);
        if (lastTwoDiff < avgDaysBetween * 0.7) {
          trend = 'Worsening';
        } else if (lastTwoDiff > avgDaysBetween * 1.5) {
          trend = 'Improving';
        }
      }

      // Cross-link with SAP Memos
      const tagUpper = item.tag.toUpperCase();
      const relatedSapMemos = (sapMemos || []).filter((memo) => {
        const memoText = `${memo.sapNo || ''} ${memo.detail || ''} ${(memo.tags || []).join(' ')}`.toUpperCase();
        return memoText.includes(tagUpper);
      });

      computedItems.push({
        rank: computedItems.length + 1,
        tag: item.tag,
        unit: item.unit,
        count: item.count,
        percentage,
        cumulativeCount,
        cumulativePercentage,
        isPareto80,
        firstSeen,
        lastSeen,
        avgDaysBetween,
        daysSinceLast,
        trend,
        sampleText: item.samples[0] || '',
        relatedSapCount: relatedSapMemos.length,
        relatedSapMemos
      });
    }

    // 4. Apply Filters (unitFilter, minIncidents, query)
    const filteredItems = computedItems.filter((item) => {
      if (unitFilter && unitFilter !== 'ALL' && item.unit !== unitFilter) return false;
      if (item.count < minIncidents) return false;
      if (q && !item.tag.toLowerCase().includes(q) && !item.sampleText.toLowerCase().includes(q)) return false;
      return true;
    });

    const pareto80Count = computedItems.filter((x) => x.isPareto80).length;
    const pareto80Percentage = allTags.length > 0 ? Number(((pareto80Count / allTags.length) * 100).toFixed(1)) : 0;

    return {
      totalIncidents,
      totalUniqueTags: allTags.length,
      pareto80Count,
      pareto80Percentage,
      items: filteredItems
    };
  },

  generateShiftHandoverDigest(entries = [], options = {}) {
    if (!Array.isArray(entries)) entries = [];
    const {
      date = '',
      shift = 'Day',
      siloOperations = [],
      washingRoutines = [],
      sapMemos = []
    } = options;

    // 1. Filter entries for this specific shift and date
    const shiftEntries = entries
      .filter((e) => e.date === date && e.shift === shift)
      .sort((a, b) => this.compareLogChronology(a, b, 'asc'));

    // Extract B/M (Boardman) and F/M (Foreman)
    let bm = '-';
    let fm = '-';
    let totalLoad = 0;
    let loadCount = 0;
    let totalCba = 0;
    let cbaCount = 0;
    let prod = 0;

    for (const e of shiftEntries) {
      if (!bm || bm === '-') bm = e.bm || '-';
      if (!fm || fm === '-') fm = e.fm || '-';
      if (e.load > 0) {
        totalLoad += e.load;
        loadCount++;
      }
      if (e.cba > 0) {
        totalCba += e.cba;
        cbaCount++;
      }
      if (e.prod > 0 && prod === 0) {
        prod = e.prod;
      }
    }

    const avgLoad = loadCount > 0 ? Number((totalLoad / loadCount).toFixed(1)) : 0;
    const avgCba = cbaCount > 0 ? Number((totalCba / cbaCount).toFixed(1)) : 0;

    // Pillar 1: Key Operations & Incidents
    const tagSet = new Set();
    const keyEvents = [];
    for (const e of shiftEntries) {
      if (Array.isArray(e.tags)) {
        for (const t of e.tags) tagSet.add(t);
      }
      keyEvents.push({
        id: e.id,
        time: e.time || '-',
        category: e.category,
        text: e.text,
        tags: e.tags || []
      });
    }

    // Pillar 2: Silo & Logistics Status
    const shiftSilo = (siloOperations || [])
      .filter((s) => s.date === date && s.shift === shift)
      .sort((a, b) => this.compareLogChronology(a, b, 'asc'));

    let latestSiloState = null;
    if (shiftSilo.length === 0 && Array.isArray(siloOperations) && siloOperations.length > 0) {
      const priorSilos = siloOperations
        .filter((s) => s.date <= date)
        .sort((a, b) => this.compareLogChronology(a, b, 'desc'));
      latestSiloState = priorSilos[0] || null;
    }

    // Pillar 3: PM-901 Washing Routine Status
    const shiftWash = (washingRoutines || []).filter((w) => w.date === date && w.shift === shift);
    const performedInShift = shiftWash.length > 0;

    let lastWashRecord = null;
    if (Array.isArray(washingRoutines) && washingRoutines.length > 0) {
      const priorWashes = washingRoutines
        .filter((w) => w.date <= date)
        .sort((a, b) => this.compareLogChronology(a, b, 'desc'));
      lastWashRecord = priorWashes[0] || null;
    }

    // Pillar 4: Pending SAP Memos
    const pendingSap = (sapMemos || []).filter((memo) => {
      const isDateMatch = memo.date === date;
      const isPending = memo.status && /REL|Not yet|Open/i.test(memo.status);
      return isDateMatch || isPending;
    }).slice(0, 5);

    return {
      date,
      shift,
      bm,
      fm,
      avgLoad,
      avgCba,
      prod,
      keyEvents,
      keyTags: Array.from(tagSet),
      siloEvents: shiftSilo,
      latestSiloState,
      washingStatus: {
        performedInShift,
        shiftWashRecords: shiftWash,
        lastWashDate: lastWashRecord ? lastWashRecord.date : '-',
        lastWashNo: lastWashRecord ? lastWashRecord.washNo : '-',
        lastWashBatch: lastWashRecord ? lastWashRecord.batchCount : null,
        lastWashDuration: lastWashRecord ? lastWashRecord.durationMin : 0
      },
      pendingSap
    };
  },

  formatShiftHandoverText(digest) {
    if (!digest) return '';
    const shiftIcon = digest.shift === 'Night' ? '🌙 กะดึก' : '☀️ กะเช้า';
    const shiftTime = digest.shift === 'Night' ? '19:30 – 07:30' : '07:30 – 19:30';

    let out = `========================================\n`;
    out += `📋 สรุปส่งเวร PTA1 (Shift Handover Digest)\n`;
    out += `📅 วันที่: ${digest.date} [${shiftIcon} ${shiftTime}]\n`;
    out += `👨‍💻 B/M (Boardman): ${digest.bm || '-'} | F/M (Foreman): ${digest.fm || '-'}\n`;
    out += `📊 โหลดเฉลี่ย: ${digest.avgLoad > 0 ? `${digest.avgLoad}%` : '-'} | 4-CBA: ${digest.avgCba > 0 ? `${digest.avgCba} ppm` : '-'}${digest.prod > 0 ? ` | ยอดผลิต: ${digest.prod} T/d` : ''}\n`;
    out += `========================================\n\n`;

    // 1. Key Operations
    out += `1. ⚙️ การเดินเครื่อง & อาการผิดปกติหน้างาน:\n`;
    if (digest.keyEvents.length === 0) {
      out += `   - การเดินเครื่องปกติ ไม่พบอาการผิดปกติ\n`;
    } else {
      for (const ev of digest.keyEvents) {
        out += `   • [${ev.time || '-'}] ${ev.text}\n`;
      }
    }
    out += `\n`;

    // 2. Silo Status
    out += `2. 🌾 สถานะ Silo 800 & โลจิสติกส์ปลายทาง:\n`;
    if (digest.siloEvents && digest.siloEvents.length > 0) {
      for (const s of digest.siloEvents) {
        out += `   • [${s.time || '-'}] ${s.switchText ? `สลับ: ${s.switchText} | ` : ''}ส่ง: ${s.destination || '-'}${s.description ? ` (${s.description})` : ''}\n`;
      }
    } else if (digest.latestSiloState) {
      const ls = digest.latestSiloState;
      out += `   • สถานะคงเดิมจากรอบก่อน: ${ls.switchText ? `สลับ ${ls.switchText} | ` : ''}ส่ง ${ls.destination || '-'}${ls.description ? ` (${ls.description})` : ''} (บันทึกเมื่อ ${ls.date})\n`;
    } else {
      out += `   - ไม่มีการสลับ Silo ในกะนี้\n`;
    }
    out += `\n`;

    // 3. Washing Status
    out += `3. 🧼 สถานะการล้างเครื่องจักร PM-901:\n`;
    const ws = digest.washingStatus;
    if (ws.performedInShift && ws.shiftWashRecords.length > 0) {
      for (const wr of ws.shiftWashRecords) {
        out += `   • ล้างเครื่องจักร ${wr.washNo || ''} (ยอด ${wr.batchCount || '-'} Batch) ใช้เวลาหยุดล้าง ${this.formatDurationMinutes(wr.durationMin)}\n`;
      }
    } else {
      out += `   • ในกะนี้ไม่มีการล้าง PM-901\n`;
      if (ws.lastWashDate !== '-') {
        out += `   • ล้างครั้งล่าสุดเมื่อ: ${ws.lastWashDate} (${ws.lastWashNo || '-'}, ${ws.lastWashBatch ? `${ws.lastWashBatch} Batch` : '-'}, หยุดล้าง ${this.formatDurationMinutes(ws.lastWashDuration)})\n`;
      }
    }
    out += `\n`;

    // 4. Pending SAP Memos
    out += `4. 🛠️ งานซ่อม SAP & Memo ค้างส่งต่อ:\n`;
    if (digest.pendingSap && digest.pendingSap.length > 0) {
      for (const m of digest.pendingSap) {
        out += `   • SAP #${m.sapNo || '-'} [สถานะ: ${m.status || 'REL'}]: ${m.detail || '-'}\n`;
      }
    } else {
      out += `   - ไม่มีงานซ่อมบำรุง SAP ค้างส่งต่อ\n`;
    }

    out += `\n========================================\n`;
    out += `A-Class WebCraft • Supasit.A Studio • PTA1 Logbook Insight`;

    return out;
  },

  /**
   * 14. Auto Kaizen & IPS Opportunity Hunter
   * Evaluates logbook entries, groups chronic tags, computes formula 1.1 financial benefit,
   * and auto-drafts complete 5-Why analysis and HCL Notes text.
   * @param {Array} entries
   * @param {Object} options
   * @returns {Object}
   */
  huntIpsOpportunities(entries = [], options = {}) {
    if (!Array.isArray(entries)) entries = [];
    const {
      monthKey = 'ALL',
      sapMemos = [],
      minIncidents = options.minIncidents !== undefined ? Number(options.minIncidents) : (AppConfig.HUNTER_CONFIG?.DEFAULT_MIN_INCIDENTS ?? 1),
      categoryFilter = 'ALL',
      query = ''
    } = options;

    const q = query.trim().toLowerCase();

    // 1. Filter entries
    let filtered = entries.filter((e) => {
      if (monthKey && monthKey !== 'ALL' && e.monthKey !== monthKey) return false;
      if (categoryFilter && categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (q) {
        const textMatch = (e.text || '').toLowerCase().includes(q);
        const tagMatch = Array.isArray(e.tags) && e.tags.some((t) => t.toLowerCase().includes(q));
        if (!textMatch && !tagMatch) return false;
      }
      return true;
    });

    // 2. Group by equipment tag
    const tagMap = new Map();
    for (const entry of filtered) {
      if (!Array.isArray(entry.tags) || entry.tags.length === 0) continue;
      for (const rawTag of entry.tags) {
        const tag = rawTag.trim();
        if (!tag || tag === 'EXAPILOT' || tag === 'FC-2302' || tag === 'FC-2602') continue;
        if (IGNORED_PREFIXES.has(tag)) continue;

        if (!tagMap.has(tag)) {
          tagMap.set(tag, {
            tag,
            unit: this.detectPlantUnit ? this.detectPlantUnit(tag) : 'Oxidation / Purification',
            entries: [],
            categories: new Set(),
            dates: [],
            bms: new Set()
          });
        }
        const rec = tagMap.get(tag);
        rec.entries.push(entry);
        if (entry.category) rec.categories.add(entry.category);
        if (entry.date) rec.dates.push(entry.date);
        if (entry.bm) rec.bms.add(entry.bm);
      }
    }

    // 3. Map SAP Memos by tag
    const sapByTag = new Map();
    for (const memo of sapMemos || []) {
      const memoText = `${memo.sapNo || ''} ${memo.detail || ''} ${(memo.tags || []).join(' ')} ${memo.tag || ''}`.toUpperCase();
      for (const tag of tagMap.keys()) {
        if (memoText.includes(tag.toUpperCase())) {
          if (!sapByTag.has(tag)) sapByTag.set(tag, []);
          sapByTag.get(tag).push(memo);
        }
      }
    }

    const hourlyRate = AppConfig.HUNTER_CONFIG?.DEFAULT_HOURLY_RATE || 350;
    const hoursPerFix = AppConfig.HUNTER_CONFIG?.HOURS_PER_INCIDENT || 2.5;

    const candidates = [];

    for (const [tag, data] of tagMap.entries()) {
      const count = data.entries.length;
      if (count < minIncidents) continue;

      const relatedSap = sapByTag.get(tag) || [];
      const sapCount = relatedSap.length;
      const isWashing = data.categories.has('WASH');
      const isChronic = count >= 3;

      // Priority Score
      const priorityScore = (count * 3) + (sapCount * 5) + (isWashing ? 4 : 0) + (isChronic ? 10 : 0);

      // Financial Benefit Calculation (Formula 1.1)
      const manHours = Number((count * hoursPerFix).toFixed(1));
      const manHourSaving = Number((manHours * hourlyRate).toFixed(2));
      const costSaving = sapCount > 0 ? (sapCount * 5000) : (count >= 3 ? 3000 : 1500);
      const totalMonthly = Number((costSaving + manHourSaving).toFixed(2));

      // Calculate intervals
      const sortedDates = [...data.dates].sort();
      const firstSeen = sortedDates[0] || '';
      const lastSeen = sortedDates[sortedDates.length - 1] || '';
      let avgDaysBetween = 0;
      if (count > 1 && firstSeen && lastSeen) {
        const diffDays = Math.max(1, Math.round((new Date(lastSeen) - new Date(firstSeen)) / (1000 * 60 * 60 * 24)));
        avgDaysBetween = Number((diffDays / (count - 1)).toFixed(1));
      }

      const sampleLines = data.entries.slice(-3).map((e) => e.text).filter(Boolean);
      const sampleText = sampleLines[sampleLines.length - 1] || '';

      // Auto-draft suggestions
      const suggestedJobName = `การปรับปรุงความเสถียรและลดการขัดข้องซ้ำซ้อนของ ${tag} (${data.unit})`;
      const suggestedCaseName = `ลดปัญหาการทำงานผิดปกติและ Chattering/Alarm ของ ${tag}`;
      const suggestedObjective = `เพิ่ม Reliability / ลด Downtime และลดชั่วโมงทำงานซ่อมบำรุงของ ${tag}`;
      const suggestedKaizenWay = '3.Modification / 5.Minimize';

      const suggestedBefore = `ในระหว่างการเดินเครื่องหน่วยผลิต PTA Unit 1 พบปัญหาเกี่ยวกับอุปกรณ์/เครื่องมือวัด ${tag} (${data.unit}) ถูกบันทึกใน Logbook รวม ${count} ครั้ง โดยมีระยะห่างการเกิดปัญหาเฉลี่ยทุกๆ ${avgDaysBetween > 0 ? `${avgDaysBetween} วัน` : 'ไม่กี่วัน'} ${sapCount > 0 ? `และมีการเปิดใบสั่งงาน SAP เพื่อแก้ไขรวม ${sapCount} รายการ` : ''} ซึ่งส่งผลให้ Boardman ต้องคอยแก้ไขหน้างานและปรับชดเชยค่าพารามิเตอร์ซ้ำซ้อน (เช่น "${sampleText}")`;

      const suggestedAfter = `ดำเนินการวิเคราะห์หาสาเหตุที่แท้จริง (Root Cause) และปรับปรุงแก้ไขเชิงวิศวกรรมที่ ${tag} เช่น ปรับตั้งรอบการตรวจเช็ก/ทำความสะอาด (Preventive Maintenance) หรือปรับจูน Control Parameter/Timer Sequence ให้เหมาะสมกับสภาวะการผลิตจริง เพื่อป้องกันปัญหาเกิดซ้ำ`;

      const suggestedEffect = `ลดความถี่การเกิดปัญหาของ ${tag} จากเดิมที่พบ ${count} ครั้ง ให้ทำงานได้อย่างต่อเนื่อง มั่นคง และช่วยประหยัดเวลาการแก้ไขปัญหาหน้างานของ Boardman รวมกว่า ${manHours} ชั่วโมง`;

      const suggested5Why = [
        `อาการที่พบ: ${tag} เกิดปัญหาขัดข้องและแจ้งเตือนใน Logbook บ่อยครั้ง (${count} ครั้ง)`,
        `Why 1: มีการทำงานผิดปกติหรือคราบตะกรัน/การสึกหรอสะสมในการเดินเครื่องต่อเนื่อง`,
        `Why 2: ยังขาดการปรับจูนพารามิเตอร์หรือรอบการทำความสะอาดเชิงป้องกันที่สอดคล้องกับพฤติกรรมจริง`,
        `Why 3: ในอดีตมักแก้ปัญหาเฉพาะหน้าเป็นรายกะ (เช่น ปรับค่า SV/MV หรือเปิดล้างฉุกเฉิน)`,
        `Root Cause: ขาดการวิเคราะห์สถิติประวัติย้อนหลังของ ${tag} เพื่อวางมาตรการป้องกันเชิงรุก (Preventive / Modification)`
      ];

      candidates.push({
        id: `hunter-${tag.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        tag,
        unit: data.unit,
        incidentCount: count,
        sapCount,
        isWashing,
        isChronic,
        priorityScore,
        firstSeen,
        lastSeen,
        avgDaysBetween,
        sampleText,
        sampleLines,
        bms: Array.from(data.bms),
        suggestedJobName,
        suggestedCaseName,
        suggestedObjective,
        suggestedKaizenWay,
        suggestedBefore,
        suggestedAfter,
        suggestedEffect,
        suggested5Why,
        benefitCalc: {
          costSaving,
          manHours,
          hourlyRate,
          oppLossTons: 0,
          tonRate: 0,
          investYear: 0,
          extraCost: 0,
          manHourSaving,
          totalMonthly
        }
      });
    }

    candidates.sort((a, b) => b.priorityScore - a.priorityScore || b.incidentCount - a.incidentCount);

    return {
      totalFound: candidates.length,
      monthKey,
      candidates
    };
  },

  /**
   * 15. Boardman Symptom & Troubleshooting Copilot
   * Classifies past shift logs into symptom categories, parses actions and outcomes,
   * and aggregates proven historical solutions for DCS operators.
   * @param {Array} entries
   * @param {Object} options
   * @returns {Object}
   */
  analyzeTroubleshootingCases(entries = [], options = {}) {
    if (!Array.isArray(entries)) entries = [];
    const {
      query = '',
      symptomCategory = 'ALL',
      monthKey = 'ALL',
      tag = ''
    } = options;

    const q = query.trim().toLowerCase();
    const tagUpper = tag.trim().toUpperCase();

    // Priority Category Matchers
    const categoryMatchers = [
      {
        key: 'HUNTING',
        patterns: [/\bhunting\b/i, /\bswing\b/i, /\boscillat\b/i, /mv\s*(up|100%|high)/i, /แกว่ง/i, /ไม่นิ่ง/i]
      },
      {
        key: 'CLOGGED',
        patterns: [/high\s*dp/i, /dp\s*high/i, /\bclog\b/i, /\bfoul\b/i, /\bblock\b/i, /\bwash/i, /\bnaoh\b/i, /ตัน/i, /ล้าง/i, /ตะกรัน/i]
      },
      {
        key: 'ALARM',
        patterns: [/\balarm\b/i, /\bhigh\b/i, /\blow\b/i, /\bexceed\b/i, /\bspike\b/i, /เตือน/i, /สูง/i, /ต่ำ/i]
      },
      {
        key: 'TRIP',
        patterns: [/\btrip\b/i, /\bcut\b/i, /\binterlock\b/i, /\bstop\b/i, /\bshutdown\b/i, /\bfail\b/i, /ตัด/i, /หยุด/i]
      },
      {
        key: 'LEAK',
        patterns: [/\bleak\b/i, /\bpassing\b/i, /\bgland\b/i, /\bpacking\b/i, /\bseal\b/i, /\bdrain\b/i, /\bblowdown\b/i, /รั่ว/i, /ซึม/i]
      },
      {
        key: 'EXAPILOT',
        patterns: [/\bexapilot\b/i, /\bsequence\b/i, /\bauto\b/i]
      }
    ];

    const actionKeywords = [
      'adjust', 'dec', 'inc', 'cut transfer', 'cut feed', 'stop', 'start', 'switch', 'swap', 'line up', 'flush', 'wash', 'clean', 'blowdown', 'reset', 'bypass', 'check', 'inspect', 'close', 'open', 'change', 'เคาะ', 'เป่า', 'ปรับ', 'ล้าง', 'สลับ', 'ตัด'
    ];

    const cases = [];
    const symptomDistribution = {
      HUNTING: 0,
      ALARM: 0,
      TRIP: 0,
      CLOGGED: 0,
      LEAK: 0,
      EXAPILOT: 0,
      OTHER: 0
    };
    const actionCounts = new Map();

    for (const entry of entries) {
      if (monthKey && monthKey !== 'ALL' && entry.monthKey !== monthKey) continue;
      const tags = Array.isArray(entry.tags) ? entry.tags : [];
      if (tagUpper && !tags.some((t) => t.toUpperCase() === tagUpper)) continue;

      const text = entry.text || '';
      if (!text.trim()) continue;

      if (q) {
        const textMatch = text.toLowerCase().includes(q);
        const tagMatch = tags.some((t) => t.toLowerCase().includes(q));
        if (!textMatch && !tagMatch) continue;
      }

      // Detect Category
      let detectedCategory = 'OTHER';
      for (const matcher of categoryMatchers) {
        if (matcher.patterns.some((p) => p.test(text))) {
          detectedCategory = matcher.key;
          break;
        }
      }

      symptomDistribution[detectedCategory] = (symptomDistribution[detectedCategory] || 0) + 1;

      if (symptomCategory !== 'ALL' && detectedCategory !== symptomCategory) {
        continue;
      }

      // Split text into Symptom, Action, and Outcome
      let symptomSummary = text;
      let actionTaken = '';
      let outcome = '';

      if (text.includes('->')) {
        const parts = text.split('->');
        symptomSummary = parts[0].trim();
        actionTaken = parts.slice(1).join('->').trim();
      } else {
        const lower = text.toLowerCase();
        let bestIdx = -1;
        for (const kw of actionKeywords) {
          const idx = lower.indexOf(kw);
          if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
            bestIdx = idx;
          }
        }
        if (bestIdx > 0) {
          symptomSummary = text.substring(0, bestIdx).trim();
          actionTaken = text.substring(bestIdx).trim();
        } else {
          actionTaken = text;
        }
      }

      const outcomeMatch = actionTaken.match(/\(([^)]+)\)$/) || text.match(/(normal|recovered|นิ่งขึ้น|ใช้งานได้|ปกติ)/i);
      if (outcomeMatch) {
        outcome = outcomeMatch[1] || outcomeMatch[0];
      }

      const cleanActionKey = actionTaken.split(';')[0].split(',')[0].slice(0, 50).trim();
      if (cleanActionKey) {
        actionCounts.set(cleanActionKey, (actionCounts.get(cleanActionKey) || 0) + 1);
      }

      cases.push({
        id: entry.id,
        date: entry.date,
        shift: entry.shift,
        bm: entry.bm,
        tags,
        rawText: text,
        symptomCategory: detectedCategory,
        symptomSummary,
        actionTaken: actionTaken || 'บันทึกติดตามอาการ',
        outcome: outcome || 'เฝ้าระวังต่อเนื่อง'
      });
    }

    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalCases: cases.length,
      symptomDistribution,
      topActions,
      cases
    };
  }
};
