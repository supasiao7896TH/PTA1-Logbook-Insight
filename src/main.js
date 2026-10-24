/**
 * ⑨ APP_CORE (src/main.js) — Application Initialization, Event Wiring & Data Orchestration
 */

import { AppConfig } from './modules/app-config.js';
import { StateStore } from './modules/state-store.js';
import { StorageEngine } from './modules/storage-engine.js';
import { LogbookParser } from './modules/logbook-parser.js';
import { GeminiAiBridge } from './modules/gemini-ai-bridge.js';
import { UIRenderer } from './modules/ui-renderer.js';
import { DebugModule } from './modules/debug-module.js';

const handlers = {
  onTabChange(tabName) {
    StateStore.set('activeTab', tabName);
    UIRenderer.renderAll(handlers);
  },

  onFilterChange(partial) {
    StateStore.updateFilters(partial);
    UIRenderer.renderAll(handlers);
  },

  onSiloFilterChange(partial) {
    StateStore.updateSiloFilters(partial);
    UIRenderer.renderAll(handlers);
  },

  onWashingFilterChange(partial) {
    StateStore.updateWashingFilters(partial);
    UIRenderer.renderAll(handlers);
  },

  onRegularWorkFilterChange(partial) {
    StateStore.updateRegularWorkFilters(partial);
    UIRenderer.renderAll(handlers);
  },

  onSapFilterChange(partial) {
    StateStore.updateSapFilters(partial);
    UIRenderer.renderAll(handlers);
  },

  onBadActorFilterChange(partial) {
    StateStore.updateBadActorFilters(partial);
    UIRenderer.renderEquipmentChronic(handlers);
  },

  onHandoverChange(partial) {
    StateStore.updateHandoverState(partial);
    UIRenderer.renderShiftHandover(handlers);
  },

  async onCreateDraftFromBadActor(badActorItem) {
    const allEntries = StateStore.get('entries') || [];
    const relatedEntries = allEntries.filter((e) => Array.isArray(e.tags) && e.tags.includes(badActorItem.tag));
    const latestEntry = relatedEntries[relatedEntries.length - 1] || {};

    const newDraft = {
      id: `ips-badactor-${badActorItem.tag.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
      jobName: `ปรับปรุงความเสถียรและลดการขัดข้องของ ${badActorItem.tag} (${badActorItem.unit} Unit)`,
      caseName: `ลดปัญหาชำรุดซ้ำซากของ ${badActorItem.tag}`,
      tags: [badActorItem.tag, badActorItem.unit.toUpperCase()],
      date: badActorItem.lastSeen || latestEntry.date || '2026-10-23',
      objective: `เพื่อเพิ่ม MTBF และลด Downtime ของ ${badActorItem.tag} ในหน่วย ${badActorItem.unit}`,
      kaizenWay: `วิเคราะห์ Root Cause และปรับปรุงการบำรุงรักษาเชิงป้องกัน (PM) หรือปรับจูน Control Parameter`,
      beforeText: `อุปกรณ์ ${badActorItem.tag} (${badActorItem.unit}) เกิดปัญหาขัดข้องและถูกบันทึกใน Logbook รวม ${badActorItem.count} ครั้ง ในรอบ 9 เดือน (ม.ค. - ต.ค. 2026) โดยมีระยะห่างการเสียเฉลี่ยทุกๆ ${badActorItem.avgDaysBetween} วัน ${badActorItem.relatedSapCount > 0 ? `และมีประวัติแจ้งซ่อม SAP จำนวน ${badActorItem.relatedSapCount} รายการ` : ''} ส่งผลให้ Boardman ต้องคอยแก้ไขหน้างานและกระทบต่อเสถียรภาพการเดินเครื่อง PTA Unit 1`,
      afterText: `ดำเนินการปรับปรุงทางวิศวกรรม/เปลี่ยนวัสดุอุปกรณ์ที่ทนทานขึ้น หรือตั้งรอบ PM ให้เร็วกว่ารอบการเสีย (${badActorItem.avgDaysBetween} วัน) เพื่อป้องกันการขัดข้องแบบฉุกเฉิน ยืดอายุการใช้งาน และลด Man-Hour ของ Boardman ในการแก้ปัญหาเฉพาะหน้า`,
      effectText: `ลดความถี่การเกิดปัญหาของ ${badActorItem.tag} จากเดิมเฉลี่ยทุกๆ ${badActorItem.avgDaysBetween} วัน ให้ทำงานต่อเนื่องได้ยาวนานขึ้น เพิ่มความพร้อมใช้งาน (Availability) ของหน่วยผลิต`,
      rootCauseText: `1. Why: ${badActorItem.tag} ขัดข้องบ่อยครั้ง (${badActorItem.count} ครั้ง)\n2. Why: มีชิ้นส่วนสึกหรอหรือมีสารเคมี/ของแข็งเกาะติดตามรอบการเดินเครื่อง\n3. Why: รอบการตรวจสอบ PM เดิมยังไม่ครอบคลุมช่วงระยะการเสื่อมสภาพจริง\n4. Why: ขาดการแจ้งเตือน Predictive Maintenance ตามสถิติ MTBF\n5. Why: ยังไม่ได้นำข้อมูลประวัติ Logbook มาวิเคราะห์หารอบเสื่อมสภาพที่แท้จริง`,
      benefitCalc: {
        costSaving: 5000,
        manHours: 4,
        hourlyRate: 350,
        oppLossTons: 0,
        tonRate: 0,
        investYear: 0,
        extraCost: 0
      }
    };

    const currentDrafts = StateStore.get('ipsDrafts') || [];
    const nextDrafts = [newDraft, ...currentDrafts];
    StateStore.set('ipsDrafts', nextDrafts);
    StateStore.set('selectedDraftId', newDraft.id);
    await StorageEngine.saveIpsDraft(newDraft);

    StateStore.set('activeTab', 'ips');
    UIRenderer.renderAll(handlers);
    UIRenderer.showToast(`สร้างร่าง IPS/Kaizen จาก Bad Actor "${badActorItem.tag}" (${badActorItem.count} ครั้ง) เรียบร้อยค่ะ!`, 'success');
  },

  async onCreateDraftFromEntry(entry) {
    const allEntries = StateStore.get('entries') || [];
    const newDraft = LogbookParser.createDraftFromEntry(entry, allEntries);
    const currentDrafts = StateStore.get('ipsDrafts') || [];
    const nextDrafts = [newDraft, ...currentDrafts];
    StateStore.set('ipsDrafts', nextDrafts);
    StateStore.set('selectedDraftId', newDraft.id);
    await StorageEngine.saveIpsDraft(newDraft);

    StateStore.set('activeTab', 'ips');
    UIRenderer.renderAll(handlers);
    UIRenderer.showToast(`สร้างร่าง IPS/Kaizen จากบันทึกวันที่ ${entry.date} เรียบร้อยค่ะ`, 'success');
  }
};

let lastLoadedTimestamp = null;
let lastProcessedMetaTimestamp = null;
let syncCheckTimer = null;
let isInitialBoot = true;

async function loadInitialData(options = {}) {
  try {
    const res = await fetch(AppConfig.DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const baseData = await res.json();
    lastLoadedTimestamp = baseData.generatedAt || new Date().toISOString();

    const customMonths = await StorageEngine.getAllCustomMonths();
    const monthsMap = new Map();
    const daysMap = new Map();
    const entriesMap = new Map();

    for (const m of baseData.months || []) monthsMap.set(m.monthKey, m);
    for (const d of baseData.daysSummary || []) daysMap.set(d.date, d);
    for (const e of baseData.entries || []) entriesMap.set(e.id, e);

    for (const cm of customMonths) {
      if (cm.monthMeta) monthsMap.set(cm.monthMeta.monthKey, cm.monthMeta);
      for (const d of cm.daysSummary || []) daysMap.set(d.date, d);
      for (const e of cm.entries || []) entriesMap.set(e.id, e);
    }

    // Sort months descending (Latest month like 2026-10 at the top)
    const months = Array.from(monthsMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    const daysSummary = Array.from(daysMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    const entries = Array.from(entriesMap.values());

    StateStore.set('months', months);
    StateStore.set('daysSummary', daysSummary);
    StateStore.set('entries', entries);
    StateStore.set('siloOperations', baseData.siloOperations || []);
    StateStore.set('washingRoutines', baseData.washingRoutines || []);
    StateStore.set('regularWorkRoutines', baseData.regularWorkRoutines || []);
    StateStore.set('sapMemos', baseData.sapMemos || []);
    StateStore.set('regularWork', baseData.regularWork || []);

    // Set default month to latest month ONLY on the very first initial boot!
    // NEVER overwrite the user's active month if they selected another month or "ALL"
    if (isInitialBoot) {
      const curFilters = StateStore.get('filters');
      if (curFilters.monthKey === 'ALL' && months.length > 0) {
        StateStore.updateFilters({ monthKey: months[0].monthKey });
      }
      isInitialBoot = false;
    }

    // Load IPS Drafts (Preset + Saved in IndexedDB)
    const savedDrafts = await StorageEngine.getAllIpsDrafts();
    const draftMap = new Map();
    for (const p of AppConfig.PRESET_IPS_DRAFTS) draftMap.set(p.id, structuredClone(p));
    for (const s of savedDrafts) draftMap.set(s.id, s);

    StateStore.set('ipsDrafts', Array.from(draftMap.values()));

    DebugModule.log(
      'INIT',
      `Loaded ${entries.length} entries, ${baseData.siloOperations?.length || 0} silo ops, ${baseData.sapMemos?.length || 0} sap memos across ${months.length} months`
    );

    // If this is a background sync update, preserve the user's scroll position and active search state!
    if (options.isSyncUpdate) {
      const prevScrollY = window.scrollY;
      const searchInput = document.getElementById('global-search-input');
      const isSearchFocused = document.activeElement === searchInput;
      const selectionStart = searchInput?.selectionStart;
      const selectionEnd = searchInput?.selectionEnd;

      UIRenderer.renderAll(handlers);

      // Restore scroll position
      window.scrollTo({ top: prevScrollY, behavior: 'instant' });

      // Restore search focus & selection if user was typing
      if (isSearchFocused && searchInput) {
        searchInput.focus();
        if (selectionStart !== null && selectionEnd !== null) {
          searchInput.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    } else {
      UIRenderer.renderAll(handlers);
    }
  } catch (err) {
    DebugModule.log('ERR_LOAD', err.message);
    UIRenderer.showToast(`โหลดฐานข้อมูลตั้งต้นไม่สำเร็จ: ${err.message}`, 'error');
  }
}

function wireEvents() {
  // Navigation tabs
  document.querySelectorAll('[data-tab-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab-btn');
      handlers.onTabChange(tab);
    });
  });

  // Global Search box
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      StateStore.updateFilters({ query: e.target.value });
      if (!['search', 'silo', 'washing', 'regular', 'sap'].includes(StateStore.get('activeTab'))) {
        StateStore.set('activeTab', 'search');
      }
      UIRenderer.renderAll(handlers);
    });
  }

  // Filter dropdowns
  const monthSelect = document.getElementById('filter-month');
  if (monthSelect) {
    monthSelect.addEventListener('change', (e) => {
      handlers.onFilterChange({ monthKey: e.target.value });
    });
  }

  const bmSelect = document.getElementById('filter-bm');
  if (bmSelect) {
    bmSelect.addEventListener('change', (e) => {
      handlers.onFilterChange({ bm: e.target.value });
    });
  }

  const shiftSelect = document.getElementById('filter-shift');
  if (shiftSelect) {
    shiftSelect.addEventListener('change', (e) => {
      handlers.onFilterChange({ shift: e.target.value });
    });
  }

  // Quick toggle "เฉพาะกะพี่ A"
  const btnMyShifts = document.getElementById('btn-my-shifts');
  if (btnMyShifts) {
    btnMyShifts.addEventListener('click', () => {
      const cur = StateStore.get('filters').bm;
      const next = cur === AppConfig.DEFAULT_BM ? 'ALL' : AppConfig.DEFAULT_BM;
      handlers.onFilterChange({ bm: next });
      UIRenderer.showToast(
        next === 'ALL' ? 'แสดงข้อมูลของทุกกะแล้วค่ะ' : 'กรองเฉพาะกะของพี่ A (C ศุภสิทธิ์) แล้วค่ะ'
      );
    });
  }

  // Reset filters
  const btnReset = document.getElementById('btn-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const latestMonth = StateStore.get('months')[0]?.monthKey || 'ALL';
      StateStore.set('filters', {
        monthKey: latestMonth,
        shift: 'ALL',
        bm: 'ALL',
        category: 'ALL',
        tag: 'ALL',
        query: '',
        sortOrder: 'desc'
      });
      StateStore.set('siloFilters', { silo: 'ALL', monthKey: 'ALL', query: '' });
      StateStore.set('washingFilters', { equipment: 'ALL', washNo: 'ALL', monthKey: 'ALL', query: '' });
      StateStore.set('regularWorkFilters', { taskKey: 'ALL', monthKey: 'ALL', query: '' });
      StateStore.set('sapFilters', { status: 'ALL', monthKey: 'ALL', query: '' });
      UIRenderer.renderAll(handlers);
      UIRenderer.showToast('ล้างตัวกรองและแสดงเดือนล่าสุดเรียบร้อยค่ะ');
    });
  }

  // Sort order toggle (Newest First vs Chronological 07:30 -> 07:30)
  const btnToggleSort = document.getElementById('btn-toggle-sort');
  if (btnToggleSort) {
    btnToggleSort.addEventListener('click', () => {
      const curOrder = StateStore.get('filters').sortOrder || 'desc';
      const nextOrder = curOrder === 'desc' ? 'asc' : 'desc';
      handlers.onFilterChange({ sortOrder: nextOrder });
      UIRenderer.showToast(
        nextOrder === 'asc'
          ? '⏱️ สลับเรียงตามเวลาจริง (07:30 ➔ 07:30 ข้ามคืน) แล้วค่ะ'
          : '⏱️ สลับเรียงจากล่าสุดขึ้นก่อน (Newest First) แล้วค่ะ'
      );
    });
  }

  // Silo filters
  const siloFilterSelect = document.getElementById('filter-silo-target');
  if (siloFilterSelect) {
    siloFilterSelect.addEventListener('change', (e) => {
      handlers.onSiloFilterChange({ silo: e.target.value });
    });
  }

  const siloMonthSelect = document.getElementById('filter-silo-month');
  if (siloMonthSelect) {
    siloMonthSelect.addEventListener('change', (e) => {
      handlers.onSiloFilterChange({ monthKey: e.target.value });
    });
  }

  const siloSearchInput = document.getElementById('search-silo-input');
  if (siloSearchInput) {
    siloSearchInput.addEventListener('input', (e) => {
      handlers.onSiloFilterChange({ query: e.target.value });
    });
  }

  // Washing routine filters
  document.querySelectorAll('#quick-wash-chips [data-wash-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chipVal = btn.getAttribute('data-wash-chip');
      const cur = StateStore.get('washingFilters').equipment;
      handlers.onWashingFilterChange({ equipment: cur === chipVal ? 'ALL' : chipVal });
    });
  });

  const washNoSelect = document.getElementById('filter-wash-no');
  if (washNoSelect) {
    washNoSelect.addEventListener('change', (e) => {
      handlers.onWashingFilterChange({ washNo: e.target.value });
    });
  }

  const washMonthSelect = document.getElementById('filter-wash-month');
  if (washMonthSelect) {
    washMonthSelect.addEventListener('change', (e) => {
      handlers.onWashingFilterChange({ monthKey: e.target.value });
    });
  }

  const washSearchInput = document.getElementById('search-wash-input');
  if (washSearchInput) {
    washSearchInput.addEventListener('input', (e) => {
      handlers.onWashingFilterChange({ query: e.target.value });
    });
  }

  // Regular Work routine filters
  document.querySelectorAll('#quick-regular-chips [data-regular-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chipVal = btn.getAttribute('data-regular-chip');
      const cur = StateStore.get('regularWorkFilters').taskKey;
      handlers.onRegularWorkFilterChange({ taskKey: cur === chipVal ? 'ALL' : chipVal });
    });
  });

  const regularTaskSelect = document.getElementById('filter-regular-task');
  if (regularTaskSelect) {
    regularTaskSelect.addEventListener('change', (e) => {
      handlers.onRegularWorkFilterChange({ taskKey: e.target.value });
    });
  }

  const regularMonthSelect = document.getElementById('filter-regular-month');
  if (regularMonthSelect) {
    regularMonthSelect.addEventListener('change', (e) => {
      handlers.onRegularWorkFilterChange({ monthKey: e.target.value });
    });
  }

  const regularSearchInput = document.getElementById('search-regular-input');
  if (regularSearchInput) {
    regularSearchInput.addEventListener('input', (e) => {
      handlers.onRegularWorkFilterChange({ query: e.target.value });
    });
  }

  // SAP Memo filters
  const sapStatusSelect = document.getElementById('filter-sap-status');
  if (sapStatusSelect) {
    sapStatusSelect.addEventListener('change', (e) => {
      handlers.onSapFilterChange({ status: e.target.value });
    });
  }

  const sapMonthSelect = document.getElementById('filter-sap-month');
  if (sapMonthSelect) {
    sapMonthSelect.addEventListener('change', (e) => {
      handlers.onSapFilterChange({ monthKey: e.target.value });
    });
  }

  const sapSearchInput = document.getElementById('search-sap-input');
  if (sapSearchInput) {
    sapSearchInput.addEventListener('input', (e) => {
      handlers.onSapFilterChange({ query: e.target.value });
    });
  }

  // Bad Actor & Pareto Filters
  const baUnitSelect = document.getElementById('filter-badactor-unit');
  if (baUnitSelect) {
    baUnitSelect.addEventListener('change', (e) => {
      handlers.onBadActorFilterChange({ unit: e.target.value });
    });
  }

  const baMinSelect = document.getElementById('filter-badactor-min');
  if (baMinSelect) {
    baMinSelect.addEventListener('change', (e) => {
      handlers.onBadActorFilterChange({ minIncidents: Number(e.target.value) || 1 });
    });
  }

  const baMonthSelect = document.getElementById('filter-badactor-month');
  if (baMonthSelect) {
    baMonthSelect.addEventListener('change', (e) => {
      handlers.onBadActorFilterChange({ monthKey: e.target.value });
    });
  }

  let badActorSearchTimer = null;
  const baSearchInput = document.getElementById('search-badactor-input');
  if (baSearchInput) {
    baSearchInput.addEventListener('input', (e) => {
      clearTimeout(badActorSearchTimer);
      badActorSearchTimer = setTimeout(() => {
        handlers.onBadActorFilterChange({ query: e.target.value });
      }, 250);
    });
  }

  // Handover Event Listeners
  const hoDateSelect = document.getElementById('handover-select-date');
  if (hoDateSelect) {
    hoDateSelect.addEventListener('change', (e) => {
      handlers.onHandoverChange({ selectedDate: e.target.value });
    });
  }

  const hoShiftSelect = document.getElementById('handover-select-shift');
  if (hoShiftSelect) {
    hoShiftSelect.addEventListener('change', (e) => {
      handlers.onHandoverChange({ selectedShift: e.target.value });
    });
  }

  document.getElementById('btn-handover-latest')?.addEventListener('click', () => {
    const entries = StateStore.get('entries') || [];
    if (entries.length > 0) {
      const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
      handlers.onHandoverChange({ selectedDate: sorted[0].date, selectedShift: sorted[0].shift || 'Day' });
      UIRenderer.showToast(`ดึงข้อมูลกะล่าสุด (${sorted[0].date} ${sorted[0].shift}) เรียบร้อยค่ะ ⚡`, 'success');
    }
  });

  const copyHandoverText = async () => {
    const text = document.getElementById('handover-formatted-preview')?.textContent || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      UIRenderer.showToast('📋 คัดลอกข้อความสรุปส่งเวรฉบับสมบูรณ์เรียบร้อยแล้วค่ะ!', 'success');
    } catch {
      UIRenderer.showToast('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคลุมดำแล้วกด Ctrl+C ค่ะ', 'error');
    }
  };

  document.getElementById('btn-handover-copy-all')?.addEventListener('click', copyHandoverText);
  document.getElementById('btn-handover-copy-preview')?.addEventListener('click', copyHandoverText);

  document.getElementById('btn-handover-ai-advice')?.addEventListener('click', async () => {
    const key = await StorageEngine.getDecryptedApiKey();
    if (!key) {
      UIRenderer.showToast('กรุณากรอก Gemini API Key ในปุ่ม "⚙️ ตั้งค่า & ย้ายเครื่อง" ก่อนใช้งาน AI ค่ะ', 'info');
      return;
    }
    const handoverText = document.getElementById('handover-formatted-preview')?.textContent || '';
    if (!handoverText) return;

    try {
      UIRenderer.showToast('กำลังให้ Gemini AI วิเคราะห์จุดเสี่ยงของกะถัดไป...');
      const prompt = `ในฐานะ Senior Process Engineer โรงงาน GC-M PTA Unit 1 จงวิเคราะห์ข้อความสรุปส่งเวรต่อไปนี้ และให้คำแนะนำข้อควรระวังพิเศษสำหรับกะถัดไป 3 ข้อสั้นๆ:\n\n${handoverText}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (aiReply) {
        const preview = document.getElementById('handover-formatted-preview');
        if (preview) {
          preview.textContent += `\n\n🤖 ข้อแนะนำพิเศษจาก Gemini AI สำหรับกะถัดไป:\n${aiReply}`;
        }
        UIRenderer.showToast('Gemini AI วิเคราะห์ข้อควรระวังเสร็จเรียบร้อยค่ะ! ✨', 'success');
      }
    } catch (err) {
      UIRenderer.showToast(`เกิดข้อผิดพลาดจาก AI: ${err.message}`, 'error');
    }
  });

  // One-Click Live SharePoint Sync button
  const btnSyncLive = document.getElementById('btn-sync-live');
  const btnSyncIcon = document.getElementById('btn-sync-live-icon');
  const btnSyncText = document.getElementById('btn-sync-live-text');

  if (btnSyncLive) {
    btnSyncLive.addEventListener('click', async () => {
      if (btnSyncLive.disabled) return;

      const fileInput = document.getElementById('excel-upload-input');
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      // On Cloudflare Workers / Mobile Web (no direct C: drive access): Auto-open Excel file picker
      if (!isLocalHost) {
        UIRenderer.showToast('☁️ ทำงานบน Cloudflare: กำลังเปิดหน้าต่างให้เลือกไฟล์ Logbook (.xlsm) ล่าสุดเพื่ออัปเดตค่ะ', 'info');
        if (fileInput) fileInput.click();
        return;
      }

      btnSyncLive.disabled = true;
      if (btnSyncIcon) btnSyncIcon.textContent = '⏳';
      if (btnSyncText) btnSyncText.textContent = 'กำลังดึงข้อมูลสด...';
      UIRenderer.showToast('กำลังสั่งดึงข้อมูลสดจากโฟลเดอร์ SharePoint เข้าสู่ Web App ค่ะ...');

      try {
        const res = await fetch('/api/sync-live', { method: 'POST' });
        if (!res.ok) {
          if (res.status === 404) {
            UIRenderer.showToast('⚠️ ไม่พบ Local Sync Server (Vite) กำลังเปิดหน้าต่างเลือกไฟล์เพื่ออัปเดตแทนค่ะ', 'info');
            if (fileInput) fileInput.click();
            return;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        await loadInitialData({ isSyncUpdate: true });
        UIRenderer.showToast('✨ ซิงค์ข้อมูล Logbook สดจาก SharePoint สำเร็จเรียบร้อยแล้วค่ะ! (คงหน้าจอและคำค้นหาปัจจุบันไว้)', 'success');
      } catch (err) {
        UIRenderer.showToast(`ซิงค์ข้อมูลไม่สำเร็จ: ${err.message}`, 'error');
      } finally {
        btnSyncLive.disabled = false;
        if (btnSyncIcon) btnSyncIcon.textContent = '⚡';
        if (btnSyncText) btnSyncText.textContent = 'ซิงค์สด SharePoint';
      }
    });
  }

  // Excel (.xlsx / .xlsm) File Upload
  const fileInput = document.getElementById('excel-upload-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        UIRenderer.showToast(`กำลังสกัดข้อมูลจากไฟล์ ${file.name}...`);
        const buf = await file.arrayBuffer();
        const parsed = await LogbookParser.parseExcelArrayBuffer(buf, file.name);
        await StorageEngine.saveCustomMonth({
          monthKey: parsed.monthMeta.monthKey,
          ...parsed
        });
        await loadInitialData();
        handlers.onFilterChange({ monthKey: parsed.monthMeta.monthKey });
        UIRenderer.showToast(
          `นำเข้า ${parsed.monthMeta.label} สำเร็จ (${parsed.daysSummary.length} วัน, ${parsed.entries.length} รายการ) ค่ะ!`,
          'success'
        );
      } catch (err) {
        UIRenderer.showToast(`นำเข้าไฟล์ไม่สำเร็จ: ${err.message}`, 'error');
      } finally {
        fileInput.value = '';
      }
    });
  }

  // IPS / Kaizen Studio live form sync
  const syncCurrentDraft = async () => {
    const drafts = StateStore.get('ipsDrafts') || [];
    const selectedId = StateStore.get('selectedDraftId');
    const draft = drafts.find((d) => d.id === selectedId);
    if (!draft) return;

    const getVal = (id) => document.getElementById(id)?.value ?? '';
    draft.jobName = getVal('ips-job-name');
    draft.caseName = getVal('ips-case-name');
    draft.objective = getVal('ips-objective');
    draft.kaizenWay = getVal('ips-kaizen-way');
    draft.beforeText = getVal('ips-before-text');
    draft.afterText = getVal('ips-after-text');
    draft.effectText = getVal('ips-effect-text');
    draft.rootCauseText = getVal('ips-rootcause-text');

    draft.benefitCalc = {
      costSaving: Number(getVal('calc-cost-saving')) || 0,
      manHours: Number(getVal('calc-man-hours')) || 0,
      hourlyRate: Number(getVal('calc-hourly-rate')) || 0,
      oppLossTons: Number(getVal('calc-opp-tons')) || 0,
      tonRate: Number(getVal('calc-ton-rate')) || 0,
      investYear: Number(getVal('calc-invest-year')) || 0,
      extraCost: Number(getVal('calc-extra-cost')) || 0
    };

    await StorageEngine.saveIpsDraft(draft);
    UIRenderer.renderIpsStudio(handlers);
  };

  const formFields = [
    'ips-job-name',
    'ips-case-name',
    'ips-objective',
    'ips-kaizen-way',
    'ips-before-text',
    'ips-after-text',
    'ips-effect-text',
    'ips-rootcause-text',
    'calc-cost-saving',
    'calc-man-hours',
    'calc-hourly-rate',
    'calc-opp-tons',
    'calc-ton-rate',
    'calc-invest-year',
    'calc-extra-cost'
  ];

  for (const fid of formFields) {
    const elNode = document.getElementById(fid);
    if (elNode) {
      elNode.addEventListener('input', syncCurrentDraft);
    }
  }

  // IPS vs Kaizen mode switch
  document.querySelectorAll('[data-ips-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      StateStore.set('ipsMode', btn.getAttribute('data-ips-mode'));
      UIRenderer.renderIpsStudio(handlers);
    });
  });

  // Copy buttons for HCL Notes
  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      UIRenderer.showToast(`คัดลอก "${label}" พร้อมวางใน HCL Notes แล้วค่ะ!`, 'success');
    } catch {
      UIRenderer.showToast('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคลุมดำแล้วกด Ctrl+C ค่ะ', 'error');
    }
  };

  document.getElementById('btn-copy-full')?.addEventListener('click', () => {
    const preview = document.getElementById('ips-formatted-preview')?.textContent || '';
    copyText(preview, 'ร่างฉบับเต็ม');
  });

  document.getElementById('btn-copy-before')?.addEventListener('click', () => {
    const txt = document.getElementById('ips-before-text')?.value || '';
    copyText(txt, 'ช่องก่อนการปรับปรุง (Before)');
  });

  document.getElementById('btn-copy-after')?.addEventListener('click', () => {
    const txt = document.getElementById('ips-after-text')?.value || '';
    copyText(txt, 'ช่องหลังการปรับปรุง (After)');
  });

  // Gemini AI Refine button
  document.getElementById('btn-ai-refine')?.addEventListener('click', async () => {
    const drafts = StateStore.get('ipsDrafts') || [];
    const selectedId = StateStore.get('selectedDraftId');
    const draft = drafts.find((d) => d.id === selectedId);
    if (!draft) return;

    try {
      UIRenderer.showToast('กำลังให้ Gemini AI ช่วยเกลาสำนวนและวิเคราะห์ Why-Why...');
      const allEntries = StateStore.get('entries') || [];
      const primaryTag = draft.tags?.[0];
      const related = primaryTag
        ? allEntries.filter((e) => Array.isArray(e.tags) && e.tags.includes(primaryTag))
        : [];
      const aiResult = await GeminiAiBridge.generateIpsFromLogEntry(
        {
          date: draft.date,
          shift: 'Shift',
          bm: AppConfig.DEFAULT_BM,
          tags: draft.tags,
          text: `${draft.beforeText} -> ${draft.afterText}`
        },
        related
      );

      Object.assign(draft, aiResult);
      await StorageEngine.saveIpsDraft(draft);
      UIRenderer.renderIpsStudio(handlers);
      UIRenderer.showToast('Gemini AI ปรับปรุงร่าง IPS/Kaizen เรียบร้อยค่ะ!', 'success');
    } catch (err) {
      UIRenderer.showToast(err.message, 'error');
    }
  });

  // Theme toggle
  const btnTheme = document.getElementById('btn-theme-toggle');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      StateStore.set('theme', next);
      StorageEngine.saveSetting('theme', next);
    });
  }

  // Settings & About Studio modal
  const modal = document.getElementById('ai-key-modal');
  const openSettingsModal = async () => {
    if (!modal) return;
    const keyInput = document.getElementById('gemini-api-key-input');
    if (keyInput) keyInput.value = await StorageEngine.getDecryptedApiKey();
    modal.hidden = false;
  };

  document.getElementById('btn-open-settings')?.addEventListener('click', openSettingsModal);

  const btnOpenAbout = document.getElementById('btn-open-about');
  if (btnOpenAbout) {
    btnOpenAbout.addEventListener('click', openSettingsModal);
    btnOpenAbout.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSettingsModal();
      }
    });
  }

  document.getElementById('btn-close-settings')?.addEventListener('click', () => {
    if (modal) modal.hidden = true;
  });

  document.getElementById('btn-modal-close-x')?.addEventListener('click', () => {
    if (modal) modal.hidden = true;
  });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.hidden = true;
      }
    });
  }

  document.getElementById('btn-save-api-key')?.addEventListener('click', async () => {
    const val = document.getElementById('gemini-api-key-input')?.value || '';
    await StorageEngine.saveEncryptedApiKey(val);
    UIRenderer.showToast('บันทึก Gemini API Key (เข้ารหัส AES-GCM 256-bit) เรียบร้อยค่ะ!', 'success');
  });

  // Backup Export
  document.getElementById('btn-export-backup')?.addEventListener('click', async () => {
    try {
      const json = await StorageEngine.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `pta1_logbook_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      UIRenderer.showToast('ดาวน์โหลดไฟล์สำรองข้อมูลเรียบร้อยค่ะ! นำไปกู้คืนบนเครื่องใหม่ได้ทันที', 'success');
    } catch (err) {
      UIRenderer.showToast(`เกิดข้อผิดพลาดในการสำรองข้อมูล: ${err.message}`, 'error');
    }
  });

  // Backup Import (Restore)
  document.getElementById('backup-import-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await StorageEngine.importAllData(text);
      await loadInitialData();
      UIRenderer.renderAll(handlers);
      if (modal) modal.hidden = true;
      UIRenderer.showToast(`กู้คืนข้อมูลสำเร็จ! นำเข้าร่าง IPS ${result.draftsImported} รายการเรียบร้อยค่ะ 🎉`, 'success');
    } catch (err) {
      UIRenderer.showToast(`กู้คืนข้อมูลไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      e.target.value = '';
    }
  });
}

async function checkSharePointDataSync() {
  try {
    const metaUrl = `${AppConfig.META_URL}?t=${Date.now()}`;
    const res = await fetch(metaUrl, { cache: 'no-store' });
    if (!res.ok) return;
    const meta = await res.json();
    if (!meta?.generatedAt) return;

    // Prevent redundant sync if we already processed this exact meta timestamp
    if (meta.generatedAt === lastProcessedMetaTimestamp) return;

    if (LogbookParser.isNewerTimestamp(lastLoadedTimestamp, meta.generatedAt)) {
      lastProcessedMetaTimestamp = meta.generatedAt;
      lastLoadedTimestamp = meta.generatedAt;

      await loadInitialData({ isSyncUpdate: true });

      const fileName = meta.lastChangedFile ? ` (${meta.lastChangedFile})` : '';
      UIRenderer.showToast(`🔄 ข้อมูล Logbook ซิงค์ล่าสุดจาก SharePoint${fileName} เรียบร้อยแล้วค่ะ! (คงหน้าจอและคำค้นหาปัจจุบันไว้)`, 'success');
    }
  } catch {
    // Silent on network error or offline mode
  }
}

function startBackgroundSyncDetector() {
  if (syncCheckTimer) clearInterval(syncCheckTimer);
  // Periodic poll every 30 seconds
  syncCheckTimer = setInterval(checkSharePointDataSync, 30000);

  // Check immediately whenever the window/tab regains focus
  window.addEventListener('focus', () => {
    checkSharePointDataSync();
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        DebugModule.log('ServiceWorker registered with scope:', reg.scope);
      }).catch((err) => {
        DebugModule.error('ServiceWorker registration failed:', err);
      });
    });
  }
}

let deferredPrompt = null;
function setupPwaInstallPrompt() {
  const btnInstall = document.getElementById('btn-pwa-install');
  if (!btnInstall) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstall.style.display = 'inline-flex';
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    DebugModule.log('PWA install prompt outcome:', outcome);
    deferredPrompt = null;
    btnInstall.style.display = 'none';
  });

  window.addEventListener('appinstalled', () => {
    btnInstall.style.display = 'none';
    deferredPrompt = null;
    UIRenderer.showToast('ติดตั้งแอป PTA1 Logbook Insight บนอุปกรณ์เรียบร้อยแล้วค่ะ! 📲', 'success');
  });
}

function setupMobileDrawer() {
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const sidebar = document.querySelector('.app-sidebar');
  if (!btnMobileMenu || !sidebar) return;

  btnMobileMenu.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar-mobile-open');
    const isOpen = sidebar.classList.contains('sidebar-mobile-open');
    btnMobileMenu.innerHTML = isOpen ? '<span>✕</span> <span>ปิด</span>' : '<span>☰</span> <span>เมนู</span>';
  });

  sidebar.addEventListener('click', (e) => {
    if (window.innerWidth <= 960 && (e.target.closest('[data-tab-btn]') || e.target.closest('.month-pill-btn'))) {
      sidebar.classList.remove('sidebar-mobile-open');
      btnMobileMenu.innerHTML = '<span>☰</span> <span>เมนู</span>';
    }
  });
}

async function init() {
  const savedTheme = await StorageEngine.getSetting('theme', 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  wireEvents();
  setupMobileDrawer();
  setupPwaInstallPrompt();
  registerServiceWorker();
  await loadInitialData();
  startBackgroundSyncDetector();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
}
