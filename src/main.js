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
let syncCheckTimer = null;

async function loadInitialData() {
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

    const months = Array.from(monthsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const daysSummary = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const entries = Array.from(entriesMap.values());

    StateStore.set('months', months);
    StateStore.set('daysSummary', daysSummary);
    StateStore.set('entries', entries);
    StateStore.set('siloOperations', baseData.siloOperations || []);
    StateStore.set('washingRoutines', baseData.washingRoutines || []);
    StateStore.set('regularWorkRoutines', baseData.regularWorkRoutines || []);
    StateStore.set('sapMemos', baseData.sapMemos || []);
    StateStore.set('regularWork', baseData.regularWork || []);

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
    UIRenderer.renderAll(handlers);
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
      StateStore.set('filters', {
        monthKey: 'ALL',
        shift: 'ALL',
        bm: 'ALL',
        category: 'ALL',
        tag: 'ALL',
        query: ''
      });
      StateStore.set('siloFilters', { silo: 'ALL', monthKey: 'ALL', query: '' });
      StateStore.set('washingFilters', { equipment: 'ALL', washNo: 'ALL', monthKey: 'ALL', query: '' });
      StateStore.set('regularWorkFilters', { taskKey: 'ALL', monthKey: 'ALL', query: '' });
      StateStore.set('sapFilters', { status: 'ALL', monthKey: 'ALL', query: '' });
      UIRenderer.renderAll(handlers);
      UIRenderer.showToast('ล้างตัวกรองทั้งหมดเรียบร้อยค่ะ');
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

  // One-Click Live SharePoint Sync button
  const btnSyncLive = document.getElementById('btn-sync-live');
  const btnSyncIcon = document.getElementById('btn-sync-live-icon');
  const btnSyncText = document.getElementById('btn-sync-live-text');

  if (btnSyncLive) {
    btnSyncLive.addEventListener('click', async () => {
      if (btnSyncLive.disabled) return;

      btnSyncLive.disabled = true;
      if (btnSyncIcon) btnSyncIcon.textContent = '⏳';
      if (btnSyncText) btnSyncText.textContent = 'กำลังดึงข้อมูลสด...';
      UIRenderer.showToast('กำลังสั่งดึงข้อมูลสดจากโฟลเดอร์ SharePoint เข้าสู่ Web App ค่ะ...');

      try {
        const res = await fetch('/api/sync-live', { method: 'POST' });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        await loadInitialData();
        UIRenderer.showToast('✨ ซิงค์ข้อมูล Logbook สดจาก SharePoint สำเร็จเรียบร้อยแล้วค่ะ!', 'success');
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

  // AI Key modal
  const modal = document.getElementById('ai-key-modal');
  document.getElementById('btn-open-settings')?.addEventListener('click', async () => {
    if (!modal) return;
    const keyInput = document.getElementById('gemini-api-key-input');
    if (keyInput) keyInput.value = await StorageEngine.getDecryptedApiKey();
    modal.hidden = false;
  });

  document.getElementById('btn-close-settings')?.addEventListener('click', () => {
    if (modal) modal.hidden = true;
  });

  document.getElementById('btn-save-api-key')?.addEventListener('click', async () => {
    const val = document.getElementById('gemini-api-key-input')?.value || '';
    await StorageEngine.saveEncryptedApiKey(val);
    if (modal) modal.hidden = true;
    UIRenderer.showToast('บันทึก Gemini API Key (เข้ารหัส AES-GCM 256-bit) เรียบร้อยค่ะ!', 'success');
  });
}

async function checkSharePointDataSync() {
  try {
    const metaUrl = `${AppConfig.META_URL}?t=${Date.now()}`;
    const res = await fetch(metaUrl, { cache: 'no-store' });
    if (!res.ok) return;
    const meta = await res.json();
    if (meta?.generatedAt && LogbookParser.isNewerTimestamp(lastLoadedTimestamp, meta.generatedAt)) {
      lastLoadedTimestamp = meta.generatedAt;
      await loadInitialData();
      const fileName = meta.lastChangedFile ? ` (${meta.lastChangedFile})` : '';
      UIRenderer.showToast(`🔄 ข้อมูล Logbook ซิงค์ล่าสุดจาก SharePoint${fileName} เรียบร้อยแล้วค่ะ!`, 'success');
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

async function init() {
  const savedTheme = await StorageEngine.getSetting('theme', 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  wireEvents();
  await loadInitialData();
  startBackgroundSyncDetector();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
}
