/**
 * ⑦ UI_RENDERER — Safe DOM Renderer following Supasit.A Studio Design System
 * Rules enforced:
 * - ST-01..04: Ink Blue (#1D4ED8) interactive pills (999px), Amber (#8A6410) reference tags,
 *   1px border + single subtle shadow, 13px card radius, Ground (#F7F9FC) != Surface (#FFFFFF)
 * - XSS prevention: All user/logbook text injected via textContent / createTextNode
 */

import { AppConfig } from './app-config.js';
import { StateStore } from './state-store.js';
import { LogbookParser } from './logbook-parser.js';

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '' && text !== null && text !== undefined) {
    node.textContent = String(text);
  }
  return node;
}

function createHighlightedText(text, query) {
  const frag = document.createDocumentFragment();
  if (!query || !query.trim()) {
    frag.appendChild(document.createTextNode(text || ''));
    return frag;
  }
  const q = query.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text || '').split(new RegExp(`(${escaped})`, 'gi'));
  for (const part of parts) {
    if (part.toLowerCase() === q.toLowerCase()) {
      const mark = el('mark', 'search-mark', part);
      frag.appendChild(mark);
    } else {
      frag.appendChild(document.createTextNode(part));
    }
  }
  return frag;
}

export const UIRenderer = {
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = el('div', `sa-toast sa-toast-${type}`, message);
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  },

  renderAll(handlers) {
    this.renderSidebarMonths(handlers);
    this.renderKpiCards(handlers);
    this.renderQuickTagBar(handlers);
    this.renderFilterSelects();

    const activeTab = StateStore.get('activeTab');
    document.querySelectorAll('[data-tab-btn]').forEach((btn) => {
      const isAct = btn.getAttribute('data-tab-btn') === activeTab;
      btn.classList.toggle('active-nav-pill', isAct);
      btn.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });

    document.querySelectorAll('[data-view-panel]').forEach((panel) => {
      const isAct = panel.getAttribute('data-view-panel') === activeTab;
      panel.hidden = !isAct;
    });

    if (activeTab === 'search') {
      this.renderSearchTimeline(handlers);
    } else if (activeTab === 'silo') {
      this.renderSiloView(handlers);
    } else if (activeTab === 'washing') {
      this.renderWashingView(handlers);
    } else if (activeTab === 'regular') {
      this.renderRegularWorkView(handlers);
    } else if (activeTab === 'sap') {
      this.renderSapView(handlers);
    } else if (activeTab === 'handover') {
      this.renderShiftHandover(handlers);
    } else if (activeTab === 'overview') {
      this.renderMonthlyOverview(handlers);
    } else if (activeTab === 'equipment') {
      this.renderEquipmentChronic(handlers);
    } else if (activeTab === 'ips') {
      this.renderIpsStudio(handlers);
    }
  },

  renderSidebarMonths(handlers) {
    const listEl = document.getElementById('sidebar-months-list');
    if (!listEl) return;
    listEl.textContent = '';

    const months = StateStore.get('months') || [];
    const filters = StateStore.get('filters');

    const allBtn = el(
      'button',
      `month-pill-btn ${filters.monthKey === 'ALL' ? 'month-pill-active' : ''}`,
      `ทุกเดือนรวมกัน (${months.length} เดือน)`
    );
    allBtn.type = 'button';
    allBtn.addEventListener('click', () => handlers.onFilterChange({ monthKey: 'ALL' }));
    listEl.appendChild(allBtn);

    for (const m of months) {
      const btn = el(
        'button',
        `month-pill-btn ${filters.monthKey === m.monthKey ? 'month-pill-active' : ''}`
      );
      btn.type = 'button';
      const left = el('span', 'font-semibold', m.label || m.monthKey);
      const right = el('span', 'month-badge-meta', `${m.daysCount} วัน · ${m.entriesCount} บันทึก`);
      btn.append(left, right);
      btn.addEventListener('click', () => handlers.onFilterChange({ monthKey: m.monthKey }));
      listEl.appendChild(btn);
    }
  },

  renderFilterSelects() {
    const entries = StateStore.get('entries') || [];
    const filters = StateStore.get('filters');

    const bmSelect = document.getElementById('filter-bm');
    if (bmSelect && bmSelect.options.length <= 1) {
      const bms = Array.from(new Set(entries.map((e) => e.bm).filter(Boolean))).sort();
      bmSelect.textContent = '';
      bmSelect.appendChild(new Option('👨‍💻 Boardman: ทั้งหมด', 'ALL'));
      for (const bm of bms) {
        const label = bm.includes('ศุภสิทธิ์') ? `⭐ ${bm} (พี่ A)` : bm;
        bmSelect.appendChild(new Option(label, bm));
      }
    }
    if (bmSelect) bmSelect.value = filters.bm || 'ALL';

    const monthSelect = document.getElementById('filter-month');
    const months = StateStore.get('months') || [];
    if (monthSelect && monthSelect.options.length !== months.length + 1) {
      monthSelect.textContent = '';
      monthSelect.appendChild(new Option('📅 เดือน: ทั้งหมด (ม.ค.–ต.ค.)', 'ALL'));
      for (const m of months) {
        monthSelect.appendChild(new Option(`${m.label} (${m.entriesCount})`, m.monthKey));
      }
    }
    if (monthSelect) monthSelect.value = filters.monthKey || 'ALL';

    const shiftSelect = document.getElementById('filter-shift');
    if (shiftSelect) shiftSelect.value = filters.shift || 'ALL';

    const searchInput = document.getElementById('global-search-input');
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.value = filters.query || '';
    }
  },

  renderKpiCards(handlers) {
    const entries = StateStore.get('entries') || [];
    const daysSummary = StateStore.get('daysSummary') || [];
    const filters = StateStore.get('filters');

    const scopedEntries = LogbookParser.filterEntries(entries, {
      monthKey: filters.monthKey
    });
    const scopedDays =
      filters.monthKey === 'ALL'
        ? daysSummary
        : daysSummary.filter((d) => d.monthKey === filters.monthKey);

    const insight = LogbookParser.computeInsights(scopedEntries, scopedDays);
    const supasitShifts = insight.bmShiftCount['C ศุภสิทธิ์'] || 0;
    const topTag = insight.topTags[0] || { tag: '-', count: 0 };

    const kpiTotalEl = document.getElementById('kpi-total-entries');
    const kpiTotalSubEl = document.getElementById('kpi-total-sub');
    if (kpiTotalEl) kpiTotalEl.textContent = scopedEntries.length.toLocaleString('en-US');
    if (kpiTotalSubEl) kpiTotalSubEl.textContent = `จาก ${insight.totalDays} วันทำการที่มีบันทึก`;

    const kpiBmEl = document.getElementById('kpi-bm-shifts');
    const kpiBmSubEl = document.getElementById('kpi-bm-sub');
    if (kpiBmEl) kpiBmEl.textContent = `${supasitShifts} กะ`;
    if (kpiBmSubEl) {
      const supasitLogs = scopedEntries.filter((e) => (e.bm || '').includes('ศุภสิทธิ์')).length;
      kpiBmSubEl.textContent = `บันทึกในกะพี่ A รวม ${supasitLogs.toLocaleString('en-US')} รายการ`;
    }

    const kpiCbaEl = document.getElementById('kpi-avg-cba');
    const kpiCbaSubEl = document.getElementById('kpi-cba-sub');
    if (kpiCbaEl) kpiCbaEl.textContent = `${insight.avgCba} ppm`;
    if (kpiCbaSubEl) {
      kpiCbaSubEl.textContent = `เกิน Target (>15 ppm) ${insight.cbaExceedCount} กะ`;
    }

    const kpiTopTagEl = document.getElementById('kpi-top-tag');
    const kpiTopTagSubEl = document.getElementById('kpi-top-tag-sub');
    if (kpiTopTagEl) kpiTopTagEl.textContent = topTag.tag;
    if (kpiTopTagSubEl) {
      kpiTopTagSubEl.textContent = `พบในบันทึก ${topTag.count} ครั้ง (คลิกเพื่อดู)`;
    }

    const topTagCard = document.getElementById('kpi-card-toptag');
    if (topTagCard && topTag.tag !== '-') {
      topTagCard.onclick = () => {
        handlers.onFilterChange({ tag: topTag.tag });
        handlers.onTabChange('search');
      };
    }

    const bmCard = document.getElementById('kpi-card-bm');
    if (bmCard) {
      bmCard.onclick = () => {
        const nextBm = filters.bm === 'C ศุภสิทธิ์' ? 'ALL' : 'C ศุภสิทธิ์';
        handlers.onFilterChange({ bm: nextBm });
        handlers.onTabChange('search');
      };
    }
  },

  renderQuickTagBar(handlers) {
    const bar = document.getElementById('quick-tag-chips');
    if (!bar) return;
    bar.textContent = '';

    const entries = StateStore.get('entries') || [];
    const filters = StateStore.get('filters');
    const scoped = LogbookParser.filterEntries(entries, {
      monthKey: filters.monthKey,
      bm: filters.bm,
      shift: filters.shift
    });
    const insight = LogbookParser.computeInsights(scoped, []);
    const popularTags = insight.topTags.slice(0, 14);

    const allChip = el(
      'button',
      `sa-chip-btn ${filters.tag === 'ALL' ? 'sa-chip-active' : ''}`,
      '🏷️ ทุก Tag อุปกรณ์'
    );
    allChip.type = 'button';
    allChip.addEventListener('click', () => handlers.onFilterChange({ tag: 'ALL' }));
    bar.appendChild(allChip);

    for (const item of popularTags) {
      const chip = el(
        'button',
        `sa-chip-btn ${filters.tag === item.tag ? 'sa-chip-active' : ''}`,
        `${item.tag} (${item.count})`
      );
      chip.type = 'button';
      chip.addEventListener('click', () =>
        handlers.onFilterChange({ tag: filters.tag === item.tag ? 'ALL' : item.tag })
      );
      bar.appendChild(chip);
    }
  },

  renderTroubleshootingCopilot(handlers) {
    const chipsEl = document.getElementById('copilot-symptom-chips');
    const toggleBtn = document.getElementById('btn-toggle-copilot-mode');
    const guidanceCard = document.getElementById('copilot-guidance-card');
    if (!chipsEl || !toggleBtn || !guidanceCard) return;

    const copilotState = StateStore.get('copilotState') || { isCopilotMode: false, activeSymptom: 'ALL' };
    const filters = StateStore.get('filters') || {};
    const entries = StateStore.get('entries') || [];

    // Toggle button
    toggleBtn.textContent = copilotState.isCopilotMode ? '❌ ปิดโหมด Copilot Guide' : '🩺 โหมดวิเคราะห์วิธีแก้ปัญหา (Copilot Guide)';
    toggleBtn.classList.toggle('btn-pill-primary', copilotState.isCopilotMode);
    toggleBtn.classList.toggle('btn-pill-secondary', !copilotState.isCopilotMode);

    // Symptom chips
    chipsEl.textContent = '';
    const categories = AppConfig.SYMPTOM_CATEGORIES || [];
    for (const cat of categories) {
      const isAct = copilotState.activeSymptom === cat.key;
      const chip = el('button', `sa-chip-btn text-xs ${isAct ? 'sa-chip-active' : ''}`, `${cat.icon} ${cat.label}`);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        handlers.onCopilotSymptomSelect(cat.key);
      });
      chipsEl.appendChild(chip);
    }

    const shouldShow = Boolean(copilotState.isCopilotMode);
    guidanceCard.style.display = shouldShow ? 'block' : 'none';
    if (!shouldShow) return;

    guidanceCard.textContent = '';

    let analysis = LogbookParser.analyzeTroubleshootingCases(entries, {
      query: filters.query,
      symptomCategory: copilotState.activeSymptom,
      tag: filters.tag !== 'ALL' ? filters.tag : '',
      monthKey: filters.monthKey !== 'ALL' ? filters.monthKey : 'ALL'
    });

    let scopeLabel = filters.monthKey !== 'ALL' ? `เดือน ${filters.monthKey}` : '9 เดือนย้อนหลัง';
    if (analysis.totalCases === 0 && filters.monthKey !== 'ALL') {
      analysis = LogbookParser.analyzeTroubleshootingCases(entries, {
        query: filters.query,
        symptomCategory: copilotState.activeSymptom,
        tag: filters.tag !== 'ALL' ? filters.tag : '',
        monthKey: 'ALL'
      });
      scopeLabel = 'ไม่พบในเดือนนี้ แต่พบในประวัติ 9 เดือนย้อนหลัง';
    }

    const activeCatObj = categories.find((c) => c.key === copilotState.activeSymptom) || categories[0];
    const isAllSymptoms = copilotState.activeSymptom === 'ALL';

    const guideWrapper = el('div', 'sa-card p-4 bg-ground border border-ref-amber-border rounded-xl flex flex-col gap-3');

    // Header
    const header = el('div', 'flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border');
    const title = el('div', 'flex items-center gap-2 flex-wrap');
    title.append(
      el('span', 'text-lg', activeCatObj.icon),
      el('h4', 'font-bold text-sm text-text-primary', isAllSymptoms ? 'ภาพรวมวิธีแก้ปัญหาทุกอาการผิดปกติในโรงงาน (PTA1 Overview)' : `วิเคราะห์วิธีแก้ปัญหา: "${activeCatObj.label}"`),
      el('span', 'badge-metric text-xs font-semibold text-brand', `${analysis.totalCases} เคส (${scopeLabel})`)
    );
    header.appendChild(title);

    // If ALL symptoms, render the 6 symptom breakdown cards
    if (isAllSymptoms) {
      const distSection = el('div', 'flex flex-col gap-1.5');
      distSection.appendChild(el('div', 'text-xs font-bold text-muted flex items-center gap-1.5', '📊 สรุปความถี่ปัญหาหน้างานแยกตามกลุ่มอาการ (คลิกเพื่อเจาะลึกเฉพาะอาการ):'));

      const distGrid = el('div', 'grid grid-cols-2 md:grid-cols-3 gap-2');
      const distItems = [
        { key: 'HUNTING', label: 'Hunting / แกว่ง', icon: '🌀', count: analysis.symptomDistribution.HUNTING || 0 },
        { key: 'ALARM', label: 'High / Low Alarm', icon: '🚨', count: analysis.symptomDistribution.ALARM || 0 },
        { key: 'TRIP', label: 'Trip / Cut Feed', icon: '🛑', count: analysis.symptomDistribution.TRIP || 0 },
        { key: 'CLOGGED', label: 'Clogged / High DP', icon: '🧼', count: analysis.symptomDistribution.CLOGGED || 0 },
        { key: 'LEAK', label: 'Leak / Passing', icon: '💧', count: analysis.symptomDistribution.LEAK || 0 },
        { key: 'EXAPILOT', label: 'Exapilot / Sequence', icon: '⚡', count: analysis.symptomDistribution.EXAPILOT || 0 }
      ];

      for (const d of distItems) {
        const dBtn = el('button', 'sa-card p-2 text-left hover:border-brand-ink transition-colors flex items-center justify-between text-xs cursor-pointer');
        dBtn.type = 'button';
        const dLeft = el('div', 'flex items-center gap-1.5');
        dLeft.append(el('span', '', d.icon), el('span', 'font-semibold', d.label));
        const dRight = el('span', 'badge-metric tabular-nums font-bold text-brand', `${d.count} เคส`);
        dBtn.append(dLeft, dRight);
        dBtn.addEventListener('click', () => {
          handlers.onCopilotSymptomSelect(d.key);
        });
        distGrid.appendChild(dBtn);
      }
      distSection.appendChild(distGrid);
      guideWrapper.appendChild(distSection);
    }

    // Top Proven Actions
    const solSection = el('div', 'flex flex-col gap-1.5');
    const solTitle = el('div', 'text-xs font-bold text-muted flex items-center gap-1.5', '💡 วิธีที่ Boardman ในอดีตใช้แก้ไขบ่อยที่สุด (Top Proven Actions):');
    solSection.appendChild(solTitle);

    if (analysis.topActions && analysis.topActions.length > 0) {
      const solList = el('div', 'grid grid-cols-1 md:grid-cols-2 gap-2');
      for (let i = 0; i < analysis.topActions.length; i++) {
        const item = analysis.topActions[i];
        const pct = analysis.totalCases > 0 ? Math.round((item.count / analysis.totalCases) * 100) : 0;
        const solCard = el('div', 'bg-surface p-2.5 rounded-lg border border-line-border flex items-center justify-between text-xs');
        const solLeft = el('div', 'flex items-center gap-2 flex-1 min-w-0 pr-2');
        solLeft.append(
          el('span', 'font-bold text-brand tabular-nums', `#${i + 1}`),
          el('span', 'font-medium truncate', item.action)
        );
        const solRight = el('span', 'badge-metric tabular-nums font-semibold shrink-0', `${item.count} ครั้ง (${pct}%)`);
        solCard.append(solLeft, solRight);
        solList.appendChild(solCard);
      }
      solSection.appendChild(solList);
    } else {
      solSection.appendChild(el('p', 'text-xs text-muted italic', 'ยังไม่มีการสรุปวิธีแก้ไขในเงื่อนไขนี้'));
    }

    // Recent resolved cases
    const caseSection = el('div', 'flex flex-col gap-1.5 pt-2 border-t border-border');
    caseSection.appendChild(el('div', 'text-xs font-bold text-muted', '📋 ตัวอย่างประวัติเหตุการณ์จริงและการแก้ไขของ Boardman (Precedents):'));

    const displayCases = analysis.cases.slice(0, 3);
    if (displayCases.length > 0) {
      const caseList = el('div', 'flex flex-col gap-2');
      for (const cs of displayCases) {
        const cRow = el('div', 'p-2.5 rounded-lg bg-surface border border-line-border text-xs flex flex-col gap-1');
        const cHead = el('div', 'flex items-center justify-between text-muted text-[11px]');
        cHead.append(
          el('span', '', `📅 ${cs.date} (${cs.shift}) · BM: ${cs.bm || '-'}`),
          el('span', 'badge-tag text-[10px]', (cs.tags || []).join(', ') || 'PTA1')
        );
        const cDetail = el('div', 'text-text-primary', `⚠️ อาการ: "${cs.symptomSummary}"`);
        const cAction = el('div', 'text-brand font-medium', `🔧 สิ่งที่ทำ: "${cs.actionTaken}" ➔ ผล: ${cs.outcome}`);
        cRow.append(cHead, cDetail, cAction);
        caseList.appendChild(cRow);
      }
      caseSection.appendChild(caseList);
    }

    guideWrapper.append(header, solSection, caseSection);
    guidanceCard.appendChild(guideWrapper);
  },

  renderSearchTimeline(handlers) {
    this.renderTroubleshootingCopilot(handlers);

    const listEl = document.getElementById('search-results-list');
    const countEl = document.getElementById('search-results-count');
    if (!listEl) return;
    listEl.textContent = '';

    const entries = StateStore.get('entries') || [];
    const filters = StateStore.get('filters') || {};
    const copilotState = StateStore.get('copilotState') || {};

    const effectiveFilters = {
      ...filters,
      symptomCategory: copilotState.activeSymptom || 'ALL'
    };

    const filtered = LogbookParser.filterEntries(entries, effectiveFilters);

    const sortOrder = filters.sortOrder || 'desc';
    const sorted = [...filtered].sort((a, b) => LogbookParser.compareLogChronology(a, b, sortOrder));

    const sortBtn = document.getElementById('btn-toggle-sort');
    if (sortBtn) {
      sortBtn.textContent =
        sortOrder === 'asc' ? '⏱️ เรียงตามเวลา (07:30 ➔ 07:30)' : '⏱️ ล่าสุดขึ้นก่อน';
      sortBtn.classList.toggle('sa-chip-active', sortOrder === 'asc');
    }

    if (countEl) {
      const activeSymptomObj = (AppConfig.SYMPTOM_CATEGORIES || []).find((c) => c.key === copilotState.activeSymptom && c.key !== 'ALL');
      const symptomSuffix = activeSymptomObj ? ` (อาการ: ${activeSymptomObj.label})` : '';
      countEl.textContent = `พบ ${sorted.length.toLocaleString('en-US')} รายการ${symptomSuffix}`;
    }

    if (sorted.length === 0) {
      const empty = el(
        'div',
        'sa-card p-8 text-center',
        'ไม่พบรายการบันทึกที่ตรงกับเงื่อนไขการค้นหา ลองกดปุ่ม "ล้างตัวกรอง" เพื่อดูข้อมูลทั้งหมดค่ะ'
      );
      listEl.appendChild(empty);
      return;
    }

    // Render up to 250 items cleanly for instant DOM responsiveness
    const displaySlice = sorted.slice(0, 250);

    for (const item of displaySlice) {
      const card = el('article', 'sa-card log-entry-card');

      const header = el('div', 'log-entry-header');
      const leftMeta = el('div', 'log-entry-meta');

      const dateBadge = el('span', 'badge-date', `${item.date}`);
      const shiftBadge = el(
        'span',
        `badge-shift ${item.shift === 'Night' ? 'badge-night' : 'badge-day'}`,
        item.shift === 'Night' ? '🌙 Night (19:30–07:30)' : '☀️ Day (07:30–19:30)'
      );
      const catBadge = el(
        'span',
        'badge-cat',
        item.category === 'QC' ? 'Quality Control' : 'Daily Work'
      );

      const isSupasit = (item.bm || '').includes('ศุภสิทธิ์');
      const bmBadge = el(
        'button',
        `badge-person ${isSupasit ? 'badge-person-highlight' : ''}`,
        `B/M: ${item.bm || '-'}`
      );
      bmBadge.type = 'button';
      bmBadge.title = 'คลิกเพื่อกรองเฉพาะกะของ Boardman (B/M) ท่านนี้';
      bmBadge.addEventListener('click', () =>
        handlers.onFilterChange({ bm: filters.bm === item.bm ? 'ALL' : item.bm })
      );

      const fmBadge = el('span', 'badge-person-muted', `F/M: ${item.fm || '-'}`);

      leftMeta.append(dateBadge, shiftBadge, catBadge, bmBadge, fmBadge);
      if (item.cba > 0) {
        const cbaBadge = el(
          'span',
          `badge-metric ${item.cba > AppConfig.TARGETS.CBA_MAX ? 'badge-metric-warn' : ''}`,
          `4-CBA: ${item.cba} ppm · Load: ${item.load || '-'}%`
        );
        leftMeta.appendChild(cbaBadge);
      }

      const draftBtn = el('button', 'btn-pill-secondary', '✨ ส่งเข้าร่าง IPS/Kaizen');
      draftBtn.type = 'button';
      draftBtn.addEventListener('click', () => handlers.onCreateDraftFromEntry(item));

      header.append(leftMeta, draftBtn);

      const bodyText = el('p', 'log-entry-text');
      if (item.time) {
        const timeSpan = el('span', 'log-time-prefix', `[${item.time}] `);
        bodyText.appendChild(timeSpan);
      }
      bodyText.appendChild(createHighlightedText(item.text, filters.query));

      const tagRow = el('div', 'log-tag-row');
      if (Array.isArray(item.tags) && item.tags.length > 0) {
        for (const t of item.tags) {
          const tChip = el('button', 'c-ref-tag', `🏷️ ${t}`);
          tChip.type = 'button';
          tChip.addEventListener('click', () =>
            handlers.onFilterChange({ tag: filters.tag === t ? 'ALL' : t })
          );
          tagRow.appendChild(tChip);
        }
      }

      card.append(header, bodyText);
      if (item.tags && item.tags.length > 0) {
        card.appendChild(tagRow);
      }
      listEl.appendChild(card);
    }

    if (sorted.length > 250) {
      const moreNotice = el(
        'div',
        'sa-card p-4 text-center text-sm',
        `แสดง 250 รายการล่าสุดจากทั้งหมด ${sorted.length.toLocaleString('en-US')} รายการ (พิมพ์คำค้นหาหรือเลือกเดือน/Tag เพื่อเจาะจงเพิ่มเติมได้ค่ะ)`
      );
      listEl.appendChild(moreNotice);
    }
  },

  renderMonthlyOverview(handlers) {
    const tbody = document.getElementById('overview-months-tbody');
    const supasitList = document.getElementById('overview-supasit-highlights');
    if (!tbody || !supasitList) return;

    tbody.textContent = '';
    supasitList.textContent = '';

    const months = StateStore.get('months') || [];
    const daysSummary = StateStore.get('daysSummary') || [];
    const entries = StateStore.get('entries') || [];

    for (const m of months) {
      const mDays = daysSummary.filter((d) => d.monthKey === m.monthKey);
      const mEntries = entries.filter((e) => e.monthKey === m.monthKey);
      const insight = LogbookParser.computeInsights(mEntries, mDays);
      const supasitCount = insight.bmShiftCount['C ศุภสิทธิ์'] || 0;
      const top3 = insight.topTags
        .slice(0, 3)
        .map((t) => `${t.tag} (${t.count})`)
        .join(', ');

      const tr = el('tr', 'table-row-hover');
      const tdMonth = el('td', 'font-semibold', m.label);
      const tdDays = el('td', 'text-right', `${m.daysCount} วัน`);
      const tdEntries = el('td', 'text-right', m.entriesCount.toLocaleString('en-US'));
      const tdSupasit = el('td', 'text-right font-semibold', `${supasitCount} กะ`);
      const tdCba = el(
        'td',
        `text-right ${insight.avgCba > 15 ? 'status-warn-text' : ''}`,
        `${insight.avgCba || '-'} ppm`
      );
      const tdProd = el('td', 'text-right', insight.avgProd ? `${insight.avgProd} T/d` : '-');
      const tdTop = el('td', '', top3 || '-');

      const tdAction = el('td', 'text-right');
      const viewBtn = el('button', 'btn-pill-secondary', 'ดูเดือนนี้');
      viewBtn.type = 'button';
      viewBtn.addEventListener('click', () => {
        handlers.onFilterChange({ monthKey: m.monthKey });
        handlers.onTabChange('search');
      });
      tdAction.appendChild(viewBtn);

      tr.append(tdMonth, tdDays, tdEntries, tdSupasit, tdCba, tdProd, tdTop, tdAction);
      tbody.appendChild(tr);
    }

    // Renderพี่ A's recent shift logs across filtered month
    const filters = StateStore.get('filters');
    const supasitEntries = LogbookParser.filterEntries(entries, {
      monthKey: filters.monthKey,
      bm: 'C ศุภสิทธิ์'
    }).sort((a, b) => b.date.localeCompare(a.date));

    for (const item of supasitEntries.slice(0, 40)) {
      const row = el('div', 'sa-card log-entry-card');
      const top = el('div', 'log-entry-header');
      const meta = el(
        'span',
        'font-semibold',
        `📅 ${item.date} (${item.shift}) · คู่กะ F/M (Foreman): ${item.fm || '-'}`
      );
      const btn = el('button', 'btn-pill-secondary', '✨ ร่าง IPS');
      btn.type = 'button';
      btn.addEventListener('click', () => handlers.onCreateDraftFromEntry(item));
      top.append(meta, btn);

      const txt = el('p', 'log-entry-text', item.text);
      row.append(top, txt);
      supasitList.appendChild(row);
    }
  },

  renderEquipmentChronic(handlers) {
    const grid = document.getElementById('equipment-chronic-grid');
    const summaryBadge = document.getElementById('badactor-summary-badge');
    const summaryText = document.getElementById('badactor-summary-text');
    if (!grid) return;
    grid.textContent = '';

    const entries = StateStore.get('entries') || [];
    const sapMemos = StateStore.get('sapMemos') || [];
    const badActorFilters = StateStore.get('badActorFilters') || {};

    const paretoResult = LogbookParser.computeParetoBadActors(entries, {
      sapMemos,
      unitFilter: badActorFilters.unit || 'ALL',
      minIncidents: Number(badActorFilters.minIncidents) || 1,
      monthKey: badActorFilters.monthKey || 'ALL',
      query: badActorFilters.query || ''
    });

    // Update Summary Banner
    if (summaryBadge) {
      summaryBadge.textContent = `⚠️ ${paretoResult.pareto80Count} Bad Actors แรก = 80% ปัญหาโรงงาน`;
    }
    if (summaryText) {
      summaryText.textContent = `วิเคราะห์จากบันทึกหน้างาน ${entries.length.toLocaleString('en-US')} รายการ: พบอุปกรณ์ทั้งหมด ${paretoResult.totalUniqueTags} ตัว (เกิดปัญหา ${paretoResult.totalIncidents} ครั้ง) โดยมีอุปกรณ์เพียง ${paretoResult.pareto80Count} ตัว (${paretoResult.pareto80Percentage}% ของ Tag ทั้งหมด) ที่สร้างปัญหาถึง 80% ของหน่วยผลิต PTA1`;
    }

    // Sync Filter Selects
    const unitSelect = document.getElementById('filter-badactor-unit');
    if (unitSelect) unitSelect.value = badActorFilters.unit || 'ALL';

    const minSelect = document.getElementById('filter-badactor-min');
    if (minSelect) minSelect.value = String(badActorFilters.minIncidents ?? '2');

    const monthSelect = document.getElementById('filter-badactor-month');
    const months = StateStore.get('months') || [];
    if (monthSelect && monthSelect.options.length !== months.length + 1) {
      monthSelect.textContent = '';
      monthSelect.appendChild(new Option('📅 ทุกรอบเดือน (9 เดือน)', 'ALL'));
      for (const m of months) {
        monthSelect.appendChild(new Option(m.label, m.monthKey));
      }
    }
    if (monthSelect) monthSelect.value = badActorFilters.monthKey || 'ALL';

    const searchInput = document.getElementById('search-badactor-input');
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.value = badActorFilters.query || '';
    }

    if (paretoResult.items.length === 0) {
      const empty = el(
        'div',
        'sa-card p-8 text-center',
        'ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไขตัวกรองค่ะ ลองเลือก "ทุกหน่วยผลิต" หรือลดเกณฑ์ความถี่ดูนะคะ'
      );
      grid.appendChild(empty);
      return;
    }

    for (const item of paretoResult.items) {
      const card = el('article', 'sa-card chronic-card flex flex-col justify-between gap-3');

      // 1. Header Row
      const head = el('div', 'flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border');
      const leftTag = el('div', 'flex items-center flex-wrap gap-2');

      const rankBadge = el('span', 'rank-badge font-bold text-sm', `#${item.rank}`);
      const tagChip = el('span', 'c-ref-tag font-bold text-base', `🏷️ ${item.tag}`);

      const unitIcon =
        item.unit === 'Reaction' ? '🌀' :
        item.unit === 'Purification' ? '🧪' :
        item.unit === 'Silo' ? '🌾' :
        item.unit === 'Utilities' ? '⚡' : '📦';
      const unitBadge = el('span', 'badge-cat font-medium', `${unitIcon} ${item.unit}`);

      leftTag.append(rankBadge, tagChip, unitBadge);

      if (item.isPareto80) {
        const paretoBadge = el(
          'span',
          'badge-metric badge-metric-warn font-bold',
          `⚠️ Top 80% (สะสม ${item.cumulativePercentage}%)`
        );
        head.append(leftTag, paretoBadge);
      } else {
        const normalBadge = el(
          'span',
          'badge-person-muted text-xs',
          `สะสม ${item.cumulativePercentage}%`
        );
        head.append(leftTag, normalBadge);
      }

      // 2. Metrics Strip (Frequency, MTBF, Last Incident, Trend)
      const metricsGrid = el('div', 'grid grid-cols-2 gap-2 text-sm bg-subtle p-2 rounded-lg');

      const mCount = el('div', 'flex flex-col');
      mCount.append(
        el('span', 'text-xs text-muted font-medium', 'ความถี่ที่พบ:'),
        el('strong', 'text-brand tabular-nums text-base', `${item.count} ครั้ง (${item.percentage}%)`)
      );

      const mMtbf = el('div', 'flex flex-col');
      mMtbf.append(
        el('span', 'text-xs text-muted font-medium', 'ระยะห่างเฉลี่ย (MTBF):'),
        el('strong', 'tabular-nums', item.avgDaysBetween > 0 ? `ทุกๆ ${item.avgDaysBetween} วัน` : 'พบครั้งเดียว')
      );

      const mLast = el('div', 'flex flex-col');
      mLast.append(
        el('span', 'text-xs text-muted font-medium', 'ครั้งล่าสุดที่บันทึก:'),
        el('strong', 'tabular-nums text-xs', `${item.daysSinceLast === 0 ? 'วันนี้' : `${item.daysSinceLast} วันก่อน`} (${item.lastSeen || '-'})`)
      );

      const mTrend = el('div', 'flex flex-col');
      const trendColor =
        item.trend === 'Worsening' ? 'text-status-crit font-bold' :
        item.trend === 'Improving' ? 'text-status-ok font-bold' : 'text-muted';
      const trendLabel =
        item.trend === 'Worsening' ? '🔥 เริ่มพังถี่ขึ้น' :
        item.trend === 'Improving' ? '🟢 นานๆ เกิดที' : '⚪ ความถี่คงที่';
      mTrend.append(
        el('span', 'text-xs text-muted font-medium', 'แนวโน้มอาการ:'),
        el('span', trendColor, trendLabel)
      );

      metricsGrid.append(mCount, mMtbf, mLast, mTrend);

      // 3. SAP Memos Link (if any)
      const sapWrap = el('div', 'flex flex-col gap-1 text-xs');
      if (item.relatedSapCount > 0) {
        const sapHead = el(
          'div',
          'flex items-center gap-1 font-semibold text-brand',
          `🛠️ เชื่อมโยงใบแจ้งซ่อม SAP (${item.relatedSapCount} รายการ):`
        );
        sapWrap.appendChild(sapHead);

        for (const memo of item.relatedSapMemos.slice(0, 2)) {
          const memoRow = el(
            'div',
            'badge-metric flex items-center justify-between text-xs',
            `SAP #${memo.sapNo || '-'} [${memo.status || 'REL'}]: ${memo.detail || '-'}`
          );
          sapWrap.appendChild(memoRow);
        }
      }

      // 4. Sample text
      const sampleText = el(
        'p',
        'chronic-sample text-xs text-muted italic line-clamp-2',
        item.sampleText ? `ตัวอย่างล่าสุด: "${item.sampleText}"` : ''
      );

      // 5. Action Buttons
      const actions = el('div', 'chronic-actions flex items-center gap-2 mt-2 pt-2 border-t border-border');

      const inspectBtn = el(
        'button',
        'btn-pill-primary flex-1 text-xs font-semibold',
        `🔍 ดูประวัติ (${item.count} ครั้ง)`
      );
      inspectBtn.type = 'button';
      inspectBtn.addEventListener('click', () => {
        handlers.onFilterChange({ tag: item.tag, query: '' });
        handlers.onTabChange('search');
      });

      const kaizenBtn = el(
        'button',
        'btn-pill-secondary text-xs font-semibold',
        '✨ ส่งทำ Kaizen / IPS'
      );
      kaizenBtn.type = 'button';
      kaizenBtn.addEventListener('click', () => {
        handlers.onCreateDraftFromBadActor(item);
      });

      actions.append(inspectBtn, kaizenBtn);

      card.append(head, metricsGrid);
      if (item.relatedSapCount > 0) card.appendChild(sapWrap);
      if (item.sampleText) card.appendChild(sampleText);
      card.appendChild(actions);

      grid.appendChild(card);
    }
  },

  renderIpsHunterPanel(handlers) {
    const gridEl = document.getElementById('hunter-candidates-grid');
    const countEl = document.getElementById('hunter-candidates-count');
    const monthSelect = document.getElementById('filter-hunter-month');
    if (!gridEl) return;
    gridEl.textContent = '';

    const entries = StateStore.get('entries') || [];
    const sapMemos = StateStore.get('sapMemos') || [];
    const months = StateStore.get('months') || [];
    const hunterFilters = StateStore.get('hunterFilters') || { monthKey: 'ALL' };

    // Sync month select options
    if (monthSelect && monthSelect.options.length !== months.length + 1) {
      monthSelect.textContent = '';
      monthSelect.appendChild(new Option('📅 ทุกรอบเดือน (9 เดือน)', 'ALL'));
      for (const m of months) {
        monthSelect.appendChild(new Option(m.label, m.monthKey));
      }
      monthSelect.addEventListener('change', (e) => {
        handlers.onHunterFilterChange({ monthKey: e.target.value });
      });
    }
    if (monthSelect) {
      monthSelect.value = hunterFilters.monthKey || 'ALL';
    }

    const huntResult = LogbookParser.huntIpsOpportunities(entries, {
      monthKey: hunterFilters.monthKey,
      sapMemos,
      minIncidents: 1
    });

    const candidates = huntResult.candidates || [];
    if (countEl) {
      countEl.textContent = `พบ ${candidates.length} โอกาสปรับปรุง`;
    }

    if (candidates.length === 0) {
      const empty = el('div', 'sa-card p-6 text-center text-muted col-span-full', 'ไม่พบโอกาสปรับปรุงในรอบเดือนที่เลือกค่ะ ลองเลือก "ทุกรอบเดือน" ดูนะคะ');
      gridEl.appendChild(empty);
      return;
    }

    const displayCandidates = candidates.slice(0, 8);

    for (const cand of displayCandidates) {
      const card = el('div', 'sa-card flex flex-col justify-between gap-2.5 p-3.5 border border-line-border hover:border-brand-ink transition-colors');
      card.style.borderRadius = '13px';

      // 1. Header
      const head = el('div', 'flex items-center justify-between gap-1 pb-1.5 border-b border-border');
      const leftTag = el('div', 'flex items-center gap-1.5');
      const tagBadge = el('span', 'badge-tag text-xs font-bold', cand.tag);
      const unitBadge = el('span', 'text-xs text-muted font-medium', `(${cand.unit})`);
      leftTag.append(tagBadge, unitBadge);

      const scoreBadge = el('span', 'badge-metric text-xs font-bold text-brand', `⭐ Score: ${cand.priorityScore}`);
      head.append(leftTag, scoreBadge);

      // 2. Metrics
      const metricsRow = el('div', 'grid grid-cols-2 gap-1.5 text-xs bg-subtle p-2 rounded-lg');
      const m1 = el('div', 'flex flex-col');
      m1.append(
        el('span', 'text-muted text-[11px]', 'พบใน Logbook:'),
        el('strong', 'tabular-nums text-brand font-semibold', `${cand.incidentCount} ครั้ง`)
      );

      const m2 = el('div', 'flex flex-col');
      m2.append(
        el('span', 'text-muted text-[11px]', 'ระยะห่างเฉลี่ย:'),
        el('strong', 'tabular-nums font-semibold', cand.avgDaysBetween > 0 ? `ทุก ${cand.avgDaysBetween} วัน` : 'พบล่าสุด')
      );

      const m3 = el('div', 'flex flex-col');
      m3.append(
        el('span', 'text-muted text-[11px]', 'ใบสั่งซ่อม SAP:'),
        el('strong', 'tabular-nums font-semibold', cand.sapCount > 0 ? `${cand.sapCount} รายการ` : 'ยังไม่มี')
      );

      const m4 = el('div', 'flex flex-col');
      m4.append(
        el('span', 'text-muted text-[11px]', 'ผลตอบแทนสูตร 1.1:'),
        el('strong', 'tabular-nums text-status-ok font-semibold', `~${cand.benefitCalc.totalMonthly.toLocaleString('en-US')} ฿/ด.`)
      );
      metricsRow.append(m1, m2, m3, m4);

      // 3. Sample
      const sample = el('p', 'text-xs text-muted italic line-clamp-2', cand.sampleText ? `"${cand.sampleText}"` : cand.suggestedCaseName);

      // 4. Action buttons
      const actions = el('div', 'flex items-center gap-2 pt-1 border-t border-border');
      const loadBtn = el('button', 'btn-pill-primary flex-1 text-xs font-semibold', '⚡ โหลดใส่ฟอร์ม IPS');
      loadBtn.type = 'button';
      loadBtn.title = 'โหลดข้อมูลและสูตร 1.1 เข้าสู่ฟอร์มและจัดหน้า HCL Notes อัตโนมัติ';
      loadBtn.addEventListener('click', () => {
        handlers.onLoadHunterCandidate(cand);
      });

      const inspectBtn = el('button', 'btn-pill-secondary text-xs font-semibold px-2', '🔍 ดูประวัติ');
      inspectBtn.type = 'button';
      inspectBtn.title = 'ไปที่หน้าค้นหาเพื่อดู Logbook ของ Tag นี้';
      inspectBtn.addEventListener('click', () => {
        handlers.onFilterChange({ tag: cand.tag, query: '' });
        handlers.onTabChange('search');
      });

      actions.append(loadBtn, inspectBtn);
      card.append(head, metricsRow, sample, actions);
      gridEl.appendChild(card);
    }
  },

  renderIpsStudio(handlers) {
    this.renderIpsHunterPanel(handlers);

    const draftListEl = document.getElementById('ips-draft-selector');
    if (!draftListEl) return;
    draftListEl.textContent = '';

    const drafts = StateStore.get('ipsDrafts') || [];
    const selectedId = StateStore.get('selectedDraftId');
    const currentDraft = drafts.find((d) => d.id === selectedId) || drafts[0];
    if (!currentDraft) return;

    for (const d of drafts) {
      const btn = el(
        'button',
        `draft-select-btn ${d.id === currentDraft.id ? 'draft-select-active' : ''}`
      );
      btn.type = 'button';
      const title = el('div', 'font-semibold', d.jobName);
      const sub = el('div', 'text-xs opacity-80', `📅 ${d.date || '-'} · ${(d.tags || []).join(', ')}`);
      btn.append(title, sub);
      btn.addEventListener('click', () => {
        StateStore.set('selectedDraftId', d.id);
        this.renderIpsStudio(handlers);
      });
      draftListEl.appendChild(btn);
    }

    // Populate form inputs with currentDraft values
    const setVal = (id, v) => {
      const node = document.getElementById(id);
      if (node && document.activeElement !== node) node.value = v ?? '';
    };

    setVal('ips-job-name', currentDraft.jobName);
    setVal('ips-case-name', currentDraft.caseName);
    setVal('ips-objective', currentDraft.objective);
    setVal('ips-kaizen-way', currentDraft.kaizenWay);
    setVal('ips-before-text', currentDraft.beforeText);
    setVal('ips-after-text', currentDraft.afterText);
    setVal('ips-effect-text', currentDraft.effectText);
    setVal('ips-rootcause-text', currentDraft.rootCauseText);

    const bc = currentDraft.benefitCalc || {};
    setVal('calc-cost-saving', bc.costSaving || 0);
    setVal('calc-man-hours', bc.manHours || 0);
    setVal('calc-hourly-rate', bc.hourlyRate || 0);
    setVal('calc-opp-tons', bc.oppLossTons || 0);
    setVal('calc-ton-rate', bc.tonRate || 0);
    setVal('calc-invest-year', bc.investYear || 0);
    setVal('calc-extra-cost', bc.extraCost || 0);

    const calcResult = LogbookParser.calculateIpsBenefit(bc);
    const totalEl = document.getElementById('calc-total-monthly');
    if (totalEl) {
      totalEl.textContent = `${calcResult.totalMonthly.toLocaleString('en-US', {
        minimumFractionDigits: 2
      })} บาท/เดือน`;
    }

    const mode = StateStore.get('ipsMode') || 'ips';
    const previewEl = document.getElementById('ips-formatted-preview');
    if (previewEl) {
      previewEl.textContent =
        mode === 'kaizen'
          ? LogbookParser.formatKaizenCard(currentDraft)
          : LogbookParser.formatIpsDraft(currentDraft);
    }

    document.querySelectorAll('[data-ips-mode]').forEach((b) => {
      b.classList.toggle('btn-pill-primary', b.getAttribute('data-ips-mode') === mode);
      b.classList.toggle('btn-pill-secondary', b.getAttribute('data-ips-mode') !== mode);
    });
  },

  renderSiloView(handlers) {
    const listEl = document.getElementById('silo-timeline-list');
    const countEl = document.getElementById('silo-results-count');
    if (!listEl) return;
    listEl.textContent = '';

    const allSiloOps = StateStore.get('siloOperations') || [];
    const siloFilters = StateStore.get('siloFilters') || {};
    const filtered = LogbookParser.filterSiloOperations(allSiloOps, siloFilters);

    // Sync filter selects
    const monthSelect = document.getElementById('filter-silo-month');
    const months = StateStore.get('months') || [];
    if (monthSelect && monthSelect.options.length !== months.length + 1) {
      monthSelect.textContent = '';
      monthSelect.appendChild(new Option('📅 เดือน: ทั้งหมด', 'ALL'));
      for (const m of months) {
        monthSelect.appendChild(new Option(`${m.label} (${m.siloCount || 0})`, m.monthKey));
      }
    }
    if (monthSelect) monthSelect.value = siloFilters.monthKey || 'ALL';

    const targetSelect = document.getElementById('filter-silo-target');
    if (targetSelect) targetSelect.value = siloFilters.silo || 'ALL';

    const searchInput = document.getElementById('search-silo-input');
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.value = siloFilters.query || '';
    }

    if (countEl) {
      countEl.textContent = `พบ ${filtered.length.toLocaleString('en-US')} รายการ (จากทั้งหมด ${allSiloOps.length.toLocaleString('en-US')} รายการ)`;
    }

    if (filtered.length === 0) {
      const empty = el(
        'div',
        'sa-card p-8 text-center',
        'ไม่พบประวัติการสลับ Silo ตามเงื่อนไขที่เลือกค่ะ'
      );
      listEl.appendChild(empty);
      return;
    }

    // Sort newest date and time first using plant chronology
    const sorted = [...filtered].sort((a, b) => LogbookParser.compareLogChronology(a, b, 'desc'));

    for (const item of sorted.slice(0, 300)) {
      const card = el('article', 'sa-card log-entry-card');
      const head = el('div', 'log-entry-header');
      const leftMeta = el('div', 'log-entry-meta');

      const dateBadge = el('span', 'badge-date', `📅 ${item.date} [${item.time || '-'}]`);
      const shiftBadge = el(
        'span',
        `badge-shift ${item.shift === 'Night' ? 'badge-night' : 'badge-day'}`,
        item.shift === 'Night' ? '🌙 Night' : '☀️ Day'
      );
      const isSupasit = (item.bm || '').includes('ศุภสิทธิ์');
      const bmBadge = el(
        'span',
        `badge-person ${isSupasit ? 'badge-person-highlight' : ''}`,
        `B/M: ${item.bm || '-'}`
      );

      leftMeta.append(dateBadge, shiftBadge, bmBadge);

      const draftBtn = el('button', 'btn-pill-secondary', '✨ ร่าง IPS จากเคสนี้');
      draftBtn.type = 'button';
      draftBtn.addEventListener('click', () => {
        handlers.onCreateDraftFromEntry({
          id: item.id,
          date: item.date,
          shift: item.shift,
          bm: item.bm,
          fm: item.fm,
          tags: ['SILO-OPERATION', 'TTK-400', 'PTK-101'],
          text: `การสลับและส่ง Silo: ${item.switchText ? `สลับ ${item.switchText}` : ''} ${item.destination ? `ส่ง ${item.destination}` : ''} ${item.description ? `(${item.description})` : ''}`
        });
      });

      head.append(leftMeta, draftBtn);

      const bodyText = el('div', 'flex flex-col gap-1 mt-1');
      if (item.switchText) {
        const switchRow = el('div', 'flex items-center gap-2');
        const badge = el('span', 'c-ref-tag', '🔄 สลับ Silo 800');
        const txt = el('strong', 'text-base', item.switchText);
        switchRow.append(badge, txt);
        bodyText.appendChild(switchRow);
      }

      if (item.destination) {
        const destRow = el('div', 'flex items-center gap-2');
        const badge = el('span', 'c-ref-tag', '📦 ปลายทางส่งผง');
        const txt = el('span', 'font-semibold', item.destination);
        destRow.append(badge, txt);
        bodyText.appendChild(destRow);
      }

      if (item.description) {
        const descRow = el('div', 'mt-1 text-sm');
        const badge = el('span', 'badge-metric badge-metric-warn mr-2', 'เหตุผล/หมายเหตุ');
        descRow.append(badge, createHighlightedText(item.description, siloFilters.query));
        bodyText.appendChild(descRow);
      }

      card.append(head, bodyText);
      listEl.appendChild(card);
    }
  },

  renderWashingView(handlers) {
    const listEl = document.getElementById('washing-timeline-list');
    const countEl = document.getElementById('wash-results-count');
    if (!listEl) return;
    listEl.textContent = '';

    const allWashing = StateStore.get('washingRoutines') || [];
    const washFilters = StateStore.get('washingFilters') || {};
    const filtered = LogbookParser.filterWashingRoutines(allWashing, washFilters);

    // Sync month select
    const monthSelect = document.getElementById('filter-wash-month');
    const months = StateStore.get('months') || [];
    if (monthSelect && monthSelect.options.length !== months.length + 1) {
      monthSelect.textContent = '';
      monthSelect.appendChild(new Option('📅 เดือน: ทั้งหมด', 'ALL'));
      for (const m of months) {
        monthSelect.appendChild(new Option(`${m.label} (${m.washingCount || 0})`, m.monthKey));
      }
    }
    if (monthSelect) monthSelect.value = washFilters.monthKey || 'ALL';

    // Sync washNo select
    const washNoSelect = document.getElementById('filter-wash-no');
    if (washNoSelect) washNoSelect.value = washFilters.washNo || 'ALL';

    // Sync search input
    const searchInput = document.getElementById('search-wash-input');
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.value = washFilters.query || '';
    }

    // Sync quick filter chips
    const activeChip = washFilters.equipment || 'ALL';
    document.querySelectorAll('#quick-wash-chips [data-wash-chip]').forEach((btn) => {
      const chipVal = btn.getAttribute('data-wash-chip');
      btn.classList.toggle('sa-chip-active', chipVal === activeChip);
    });

    if (countEl) {
      countEl.textContent = `พบ ${filtered.length.toLocaleString('en-US')} รายการ (จากทั้งหมด ${allWashing.length.toLocaleString('en-US')} ครั้ง)`;
    }

    if (filtered.length === 0) {
      const empty = el(
        'div',
        'sa-card p-8 text-center',
        'ไม่พบประวัติการล้างเครื่องจักรตามเงื่อนไขที่เลือกค่ะ ลองกดปุ่ม "ทั้งหมด (All)" เพื่อดูข้อมูลทั้งหมดนะคะ'
      );
      listEl.appendChild(empty);
      return;
    }

    // Sort newest date and time first using plant chronology
    const sorted = [...filtered].sort((a, b) => LogbookParser.compareLogChronology(a, b, 'desc'));

    for (const item of sorted) {
      const card = el('article', 'sa-card log-entry-card');
      const head = el('div', 'log-entry-header');
      const leftMeta = el('div', 'log-entry-meta');

      const dateBadge = el('span', 'badge-date', `📅 ${item.date}`);
      const shiftBadge = el(
        'span',
        `badge-shift ${item.shift === 'Night' ? 'badge-night' : 'badge-day'}`,
        item.shift === 'Night' ? '🌙 Night' : '☀️ Day'
      );
      const isSupasit = (item.bm || '').includes('ศุภสิทธิ์');
      const bmBadge = el(
        'button',
        `badge-person ${isSupasit ? 'badge-person-highlight' : ''}`,
        `B/M: ${item.bm || '-'}`
      );
      bmBadge.type = 'button';
      bmBadge.title = 'คลิกเพื่อกรองกะของ Boardman (B/M) ท่านนี้';
      bmBadge.addEventListener('click', () => {
        handlers.onWashingFilterChange({ query: washFilters.query === item.bm ? '' : item.bm });
      });

      const fmBadge = el('span', 'badge-person-muted', `F/M: ${item.fm || '-'}`);

      leftMeta.append(dateBadge, shiftBadge, bmBadge, fmBadge);

      const draftBtn = el('button', 'btn-pill-secondary', '✨ ร่าง IPS จากเคสนี้');
      draftBtn.type = 'button';
      draftBtn.addEventListener('click', () => {
        handlers.onCreateDraftFromEntry({
          id: item.id,
          date: item.date,
          shift: item.shift,
          bm: item.bm,
          fm: item.fm,
          tags: ['PM-901', 'WASHING', item.pp404Target !== '-' ? item.pp404Target : 'PP-404'],
          text: `Routine ล้างเครื่องจักร ${item.washNo} (${item.batchCount != null ? `${item.batchCount} Batch` : '-'}): High Pressure @ ${item.hpTime || '-'}, ล้าง ${item.pp404Target !== '-' ? item.pp404Target : 'PP-404'}${item.pp404Time ? ` @ ${item.pp404Time}` : ''}, ล้าง PJ-404: ${item.naohPj404 || '-'}, ล้าง PM-901: ${item.naohPm901Time || '-'}, Start: ${item.pm901StartTime || '-'} (รอบหยุดล้างรวม ${LogbookParser.formatDurationMinutes(item.durationMin)})`
        });
      });

      head.append(leftMeta, draftBtn);

      // Body layout: Key metrics & Timeline sequence
      const bodyWrap = el('div', 'flex flex-col gap-2 mt-2');

      // Key Badges Row
      const badgeRow = el('div', 'flex flex-wrap items-center gap-2');

      // Wash No Badge
      const washNoBadge = el(
        'span',
        'c-ref-tag font-bold',
        `🔄 ${item.washNo || '-'}`
      );
      badgeRow.appendChild(washNoBadge);

      // Batch Count Badge (highlight if >= 30)
      if (item.batchCount != null) {
        const isHighBatch = item.batchCount >= 30;
        const batchBadge = el(
          'span',
          `badge-metric ${isHighBatch ? 'badge-metric-warn' : ''}`,
          `🔢 ${item.batchCount} Batch${isHighBatch ? ' ⚠️ (≥30)' : ''}`
        );
        badgeRow.appendChild(batchBadge);
      }

      // Duration Badge
      if (item.durationMin > 0) {
        const durBadge = el(
          'span',
          'badge-metric',
          `⏳ หยุดล้าง: ${LogbookParser.formatDurationMinutes(item.durationMin)}`
        );
        badgeRow.appendChild(durBadge);
      }

      // PP-404 Target Badge
      if (item.pp404Target && item.pp404Target !== '-') {
        const ppBadge = el(
          'span',
          'c-ref-tag font-semibold',
          `🎯 ล้าง ${item.pp404Target}${item.pp404Time ? ` @ ${item.pp404Time}` : ''}`
        );
        badgeRow.appendChild(ppBadge);
      }

      bodyWrap.appendChild(badgeRow);

      // Detailed Timeline Step Strip
      const timelineStrip = el('div', 'timeline-step-strip flex flex-wrap items-center gap-2 text-sm mt-1');

      const createStep = (icon, label, val) => {
        const step = el('div', 'flex items-center gap-1');
        const iconSpan = el('span', '', icon);
        const lbl = el('span', 'text-xs text-muted font-medium', label);
        const v = el('strong', 'tabular-nums', val);
        step.append(iconSpan, lbl, v);
        return step;
      };

      if (item.hpTime) {
        timelineStrip.appendChild(createStep('⏱️', 'HP PM-901:', item.hpTime));
      }
      if (item.naohPj404 && item.naohPj404 !== 'No' && item.naohPj404 !== '-') {
        timelineStrip.appendChild(createStep('🌀', 'ล้าง PJ-404:', item.naohPj404));
      }
      if (item.naohMlLine && item.naohMlLine !== 'No' && item.naohMlLine !== '-') {
        timelineStrip.appendChild(createStep('🧪', 'ล้าง ML Line:', item.naohMlLine));
      }
      if (item.naohPm901Time) {
        timelineStrip.appendChild(createStep('⚙️', 'ล้าง PM-901:', item.naohPm901Time));
      }
      if (item.pm901StartTime) {
        timelineStrip.appendChild(createStep('▶️', 'Start PM-901:', item.pm901StartTime));
      }
      if (item.naohLi2901) {
        const liStep = el('span', 'badge-metric', '🚿 Flushing LI-2901');
        timelineStrip.appendChild(liStep);
      }
      if (item.requestCta && item.requestCta !== 'No') {
        const ctaStep = el('span', 'badge-metric badge-metric-warn', 'Request CTA 4% NaOH: Yes');
        timelineStrip.appendChild(ctaStep);
      }

      bodyWrap.appendChild(timelineStrip);

      card.append(head, bodyWrap);
      listEl.appendChild(card);
    }
  },

  renderRegularWorkView(handlers) {
    const listEl = document.getElementById('regular-timeline-list');
    const countEl = document.getElementById('regular-results-count');
    if (!listEl) return;
    listEl.textContent = '';

    const allRW = StateStore.get('regularWorkRoutines') || [];
    const rwFilters = StateStore.get('regularWorkFilters') || {};
    const filtered = LogbookParser.filterRegularWorkRoutines(allRW, rwFilters);

    // Sync month select
    const monthSelect = document.getElementById('filter-regular-month');
    const months = StateStore.get('months') || [];
    if (monthSelect && monthSelect.options.length !== months.length + 1) {
      monthSelect.textContent = '';
      monthSelect.appendChild(new Option('📅 เดือน: ทั้งหมด', 'ALL'));
      for (const m of months) {
        monthSelect.appendChild(new Option(`${m.label} (${m.regularWorkCount || 0})`, m.monthKey));
      }
    }
    if (monthSelect) monthSelect.value = rwFilters.monthKey || 'ALL';

    // Sync task select
    const taskSelect = document.getElementById('filter-regular-task');
    if (taskSelect) taskSelect.value = rwFilters.taskKey || 'ALL';

    // Sync search input
    const searchInput = document.getElementById('search-regular-input');
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.value = rwFilters.query || '';
    }

    // Sync quick filter chips
    const activeChip = rwFilters.taskKey || 'ALL';
    document.querySelectorAll('#quick-regular-chips [data-regular-chip]').forEach((btn) => {
      const chipVal = btn.getAttribute('data-regular-chip');
      btn.classList.toggle('sa-chip-active', chipVal === activeChip);
    });

    if (countEl) {
      countEl.textContent = `พบ ${filtered.length.toLocaleString('en-US')} รายการ (จากทั้งหมด ${allRW.length.toLocaleString('en-US')} ครั้งที่มีการทำจริง)`;
    }

    if (filtered.length === 0) {
      const empty = el(
        'div',
        'sa-card p-8 text-center',
        'ไม่พบรายการ Regular Work ตามเงื่อนไขที่เลือกค่ะ ลองกดปุ่ม "ทั้งหมด (All)" เพื่อดูข้อมูลทั้งหมดนะคะ'
      );
      listEl.appendChild(empty);
      return;
    }

    // Sort newest date and time first using plant chronology
    const sorted = [...filtered].sort((a, b) => LogbookParser.compareLogChronology(a, b, 'desc'));

    for (const item of sorted) {
      const card = el('article', 'sa-card log-entry-card');
      const head = el('div', 'log-entry-header');
      const leftMeta = el('div', 'log-entry-meta');

      const dateBadge = el('span', 'badge-date', `📅 ${item.date}`);
      const timeBadge = el('span', 'badge-metric font-bold', `⏱️ ${item.time || '-'}`);
      const isSupasit = (item.bm || '').includes('ศุภสิทธิ์');
      const bmBadge = el(
        'button',
        `badge-person ${isSupasit ? 'badge-person-highlight' : ''}`,
        `B/M: ${item.bm || '-'}`
      );
      bmBadge.type = 'button';
      bmBadge.title = 'คลิกเพื่อกรองกะของ Boardman (B/M) ท่านนี้';
      bmBadge.addEventListener('click', () => {
        handlers.onRegularWorkFilterChange({ query: rwFilters.query === item.bm ? '' : item.bm });
      });

      const fmBadge = el('span', 'badge-person-muted', `F/M: ${item.fm || '-'}`);

      leftMeta.append(dateBadge, timeBadge, bmBadge, fmBadge);

      const draftBtn = el('button', 'btn-pill-secondary', '✨ ร่าง IPS จากงานนี้');
      draftBtn.type = 'button';
      draftBtn.addEventListener('click', () => {
        handlers.onCreateDraftFromEntry({
          id: item.id,
          date: item.date,
          shift: item.shift || 'Day',
          bm: item.bm,
          fm: item.fm,
          tags: item.tags || ['REGULAR-WORK'],
          text: `งานบำรุงรักษาประจำกะ (Regular Work): ${item.taskTitle} [เวลา ${item.time}] ${item.valueDetail ? `(รายละเอียด: ${item.valueDetail})` : ''} - สถานะ: ${item.note}`
        });
      });

      head.append(leftMeta, draftBtn);

      // Body layout
      const bodyWrap = el('div', 'flex flex-col gap-2 mt-2');

      // Title & highlight
      const titleRow = el('div', 'log-entry-text font-semibold');
      titleRow.appendChild(createHighlightedText(item.taskTitle, rwFilters.query));
      bodyWrap.appendChild(titleRow);

      // Detail Badges
      const detailRow = el('div', 'flex flex-wrap items-center gap-2');

      const noteBadge = el('span', 'c-ref-tag', `📋 ${item.note}`);
      detailRow.appendChild(noteBadge);

      if (item.valueDetail) {
        const valBadge = el(
          'span',
          'badge-metric badge-metric-warn font-semibold',
          `⚙️ ข้อมูลหน้างาน: ${item.valueDetail}`
        );
        detailRow.appendChild(valBadge);
      }

      bodyWrap.appendChild(detailRow);

      card.append(head, bodyWrap);
      listEl.appendChild(card);
    }
  },

  renderSapView(handlers) {
    const listEl = document.getElementById('sap-timeline-list');
    const countEl = document.getElementById('sap-results-count');
    if (!listEl) return;
    listEl.textContent = '';

    const allMemos = StateStore.get('sapMemos') || [];
    const sapFilters = StateStore.get('sapFilters') || {};
    const filtered = LogbookParser.filterSapMemos(allMemos, sapFilters);

    const monthSelect = document.getElementById('filter-sap-month');
    const months = StateStore.get('months') || [];
    if (monthSelect && monthSelect.options.length !== months.length + 1) {
      monthSelect.textContent = '';
      monthSelect.appendChild(new Option('📅 เดือน: ทั้งหมด', 'ALL'));
      for (const m of months) {
        monthSelect.appendChild(new Option(`${m.label} (${m.sapCount || 0})`, m.monthKey));
      }
    }
    if (monthSelect) monthSelect.value = sapFilters.monthKey || 'ALL';

    const statusSelect = document.getElementById('filter-sap-status');
    if (statusSelect) statusSelect.value = sapFilters.status || 'ALL';

    const searchInput = document.getElementById('search-sap-input');
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.value = sapFilters.query || '';
    }

    if (countEl) {
      countEl.textContent = `พบ ${filtered.length.toLocaleString('en-US')} รายการ`;
    }

    if (filtered.length === 0) {
      const empty = el('div', 'sa-card p-8 text-center', 'ไม่พบรายการใบแจ้งซ่อม SAP หรือ Memo ตามเงื่อนไขค่ะ');
      listEl.appendChild(empty);
      return;
    }

    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

    for (const item of sorted) {
      const card = el('article', 'sa-card log-entry-card');
      const head = el('div', 'log-entry-header');
      const left = el('div', 'log-entry-meta');

      const dateBadge = el('span', 'badge-date', `📅 ${item.date}`);
      if (item.sapNo) {
        const sapBadge = el('span', 'c-ref-tag', `SAP #${item.sapNo}`);
        left.appendChild(sapBadge);
      }
      if (item.status) {
        const stBadge = el('span', 'badge-shift badge-night', `สถานะ: ${item.status}`);
        left.appendChild(stBadge);
      }
      left.prepend(dateBadge);

      const draftBtn = el('button', 'btn-pill-secondary', '✨ ร่าง IPS จากปัญหานี้');
      draftBtn.type = 'button';
      draftBtn.addEventListener('click', () => {
        handlers.onCreateDraftFromEntry({
          id: item.id,
          date: item.date,
          shift: 'Day',
          bm: AppConfig.DEFAULT_BM,
          tags: LogbookParser.extractTags(item.detail),
          text: `[งานแจ้งซ่อม SAP #${item.sapNo || '-'}] ${item.detail}`
        });
      });

      head.append(left, draftBtn);

      const bodyText = el('p', 'log-entry-text mt-1');
      bodyText.appendChild(createHighlightedText(item.detail, sapFilters.query));

      if (item.remark) {
        const rem = el('p', 'text-xs opacity-75 mt-1', `หมายเหตุเพิ่มเติม: ${item.remark}`);
        card.append(head, bodyText, rem);
      } else {
        card.append(head, bodyText);
      }

      listEl.appendChild(card);
    }
  },

  renderShiftHandover(handlers) {
    const entries = StateStore.get('entries') || [];
    const siloOperations = StateStore.get('siloOperations') || [];
    const washingRoutines = StateStore.get('washingRoutines') || [];
    const sapMemos = StateStore.get('sapMemos') || [];
    const handoverState = StateStore.get('handoverState') || {};

    let targetDate = handoverState.selectedDate;
    let targetShift = handoverState.selectedShift || 'Day';

    if (!targetDate && entries.length > 0) {
      const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));
      targetDate = sortedEntries[0].date;
      targetShift = sortedEntries[0].shift || 'Day';
      StateStore.set('handoverState', { ...handoverState, selectedDate: targetDate, selectedShift: targetShift });
    }

    const dateSelect = document.getElementById('handover-select-date');
    if (dateSelect) {
      const dateSet = new Set();
      for (const e of entries) {
        if (e.date) dateSet.add(e.date);
      }
      const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

      if (dateSelect.options.length !== sortedDates.length) {
        dateSelect.textContent = '';
        for (const d of sortedDates) {
          dateSelect.appendChild(new Option(`📅 ${d}`, d));
        }
      }
      dateSelect.value = targetDate || '';
    }

    const shiftSelect = document.getElementById('handover-select-shift');
    if (shiftSelect) {
      shiftSelect.value = targetShift;
    }

    const digest = LogbookParser.generateShiftHandoverDigest(entries, {
      date: targetDate,
      shift: targetShift,
      siloOperations,
      washingRoutines,
      sapMemos
    });

    const titleEl = document.getElementById('handover-title');
    const personnelEl = document.getElementById('handover-personnel');
    const metricsStrip = document.getElementById('handover-metrics-strip');

    const shiftIcon = digest.shift === 'Night' ? '🌙 กะดึก (19:30 – 07:30)' : '☀️ กะเช้า (07:30 – 19:30)';
    if (titleEl) {
      titleEl.textContent = `📋 สรุปส่งเวร: วันที่ ${digest.date} [${shiftIcon}]`;
    }
    if (personnelEl) {
      personnelEl.textContent = `👨‍💻 B/M (Boardman): ${digest.bm} · 👷‍♂️ F/M (Foreman): ${digest.fm}`;
    }

    if (metricsStrip) {
      metricsStrip.textContent = '';
      if (digest.avgLoad > 0) {
        metricsStrip.appendChild(el('span', 'c-ref-tag font-bold', `📊 โหลดเฉลี่ย: ${digest.avgLoad}%`));
      }
      if (digest.avgCba > 0) {
        const isCbaHigh = digest.avgCba > AppConfig.TARGETS.CBA_MAX;
        metricsStrip.appendChild(el('span', `badge-metric ${isCbaHigh ? 'badge-metric-warn' : ''}`, `🧪 4-CBA: ${digest.avgCba} ppm`));
      }
      if (digest.prod > 0) {
        metricsStrip.appendChild(el('span', 'badge-metric', `📦 ยอดผลิต: ${digest.prod} T/d`));
      }
    }

    // Pillar 1: Operations
    const p1Badge = document.getElementById('handover-p1-badge');
    const p1Content = document.getElementById('handover-p1-content');
    if (p1Badge) p1Badge.textContent = `${digest.keyEvents.length} เหตุการณ์`;
    if (p1Content) {
      p1Content.textContent = '';
      if (digest.keyEvents.length === 0) {
        p1Content.appendChild(el('div', 'text-xs text-muted p-3 text-center', 'การเดินเครื่องปกติ ไม่พบอาการผิดปกติในกะนี้ค่ะ'));
      } else {
        for (const ev of digest.keyEvents) {
          const row = el('div', 'sa-card p-2 text-xs flex flex-col gap-1');
          const top = el('div', 'flex items-center gap-1 font-semibold');
          top.append(el('span', 'text-brand', `[${ev.time || '-'}]`), el('span', 'badge-cat text-xs', ev.category));
          row.append(top, el('div', 'text-secondary', ev.text));
          p1Content.appendChild(row);
        }
      }
    }

    // Pillar 2: Silo Status
    const p2Badge = document.getElementById('handover-p2-badge');
    const p2Content = document.getElementById('handover-p2-content');
    if (p2Badge) p2Badge.textContent = digest.siloEvents.length > 0 ? `${digest.siloEvents.length} รายการในกะ` : 'สถานะสืบทอด';
    if (p2Content) {
      p2Content.textContent = '';
      if (digest.siloEvents.length > 0) {
        for (const s of digest.siloEvents) {
          const row = el('div', 'sa-card p-2 text-xs flex flex-col gap-1');
          const top = el('div', 'flex items-center gap-1 font-semibold text-brand');
          top.append(el('span', '', `⏱️ [${s.time || '-'}]`), el('span', 'c-ref-tag', s.switchText ? `สลับ: ${s.switchText}` : 'ส่งผง'));
          const desc = el('div', 'font-medium', `ปลายทาง: ${s.destination || '-'}${s.description ? ` (${s.description})` : ''}`);
          row.append(top, desc);
          p2Content.appendChild(row);
        }
      } else if (digest.latestSiloState) {
        const ls = digest.latestSiloState;
        const row = el('div', 'sa-card p-2 text-xs flex flex-col gap-1 bg-subtle');
        row.append(
          el('div', 'text-xs text-muted font-semibold', `📌 สถานะเดินต่อเนื่อง (จากบันทึก ${ls.date} ${ls.time}):`),
          el('div', 'font-bold text-brand', `${ls.switchText ? `สลับ ${ls.switchText} | ` : ''}ส่ง ${ls.destination || '-'}`),
          el('div', 'text-secondary', ls.description ? `หมายเหตุ: ${ls.description}` : '')
        );
        p2Content.appendChild(row);
      } else {
        p2Content.appendChild(el('div', 'text-xs text-muted p-3 text-center', 'ไม่มีการสลับ Silo ในกะนี้ค่ะ'));
      }
    }

    // Pillar 3: PM-901 Washing
    const p3Badge = document.getElementById('handover-p3-badge');
    const p3Content = document.getElementById('handover-p3-content');
    const ws = digest.washingStatus;
    if (p3Badge) p3Badge.textContent = ws.performedInShift ? 'มีการล้างในกะนี้ 🧼' : 'ไม่ล้างในกะนี้';
    if (p3Content) {
      p3Content.textContent = '';
      if (ws.performedInShift && ws.shiftWashRecords.length > 0) {
        for (const wr of ws.shiftWashRecords) {
          const row = el('div', 'sa-card p-2 text-xs flex flex-col gap-1 bg-subtle border-brand');
          row.append(
            el('div', 'font-bold text-brand flex items-center gap-1', `🧼 ${wr.washNo} (${wr.batchCount || '-'} Batch)`),
            el('div', '', `ล้าง ${wr.pp404Target || 'PP-404'} @ ${wr.pp404Time || '-'} · หยุดล้างรวม: ${LogbookParser.formatDurationMinutes(wr.durationMin)}`)
          );
          p3Content.appendChild(row);
        }
      } else {
        const row = el('div', 'sa-card p-2 text-xs flex flex-col gap-1');
        row.append(
          el('div', 'font-semibold text-secondary', '• ในกะนี้ไม่มีการล้างเครื่องจักร PM-901'),
          el('div', 'text-muted', ws.lastWashDate !== '-' ? `• ล้างครั้งล่าสุดเมื่อ: ${ws.lastWashDate} (${ws.lastWashNo || '-'}, ${ws.lastWashBatch ? `${ws.lastWashBatch} Batch` : '-'}, หยุดล้าง ${LogbookParser.formatDurationMinutes(ws.lastWashDuration)})` : '')
        );
        p3Content.appendChild(row);
      }
    }

    // Pillar 4: Pending SAP Memos
    const p4Badge = document.getElementById('handover-p4-badge');
    const p4Content = document.getElementById('handover-p4-content');
    if (p4Badge) p4Badge.textContent = `${digest.pendingSap.length} งานค้างส่งต่อ`;
    if (p4Content) {
      p4Content.textContent = '';
      if (digest.pendingSap.length === 0) {
        p4Content.appendChild(el('div', 'text-xs text-muted p-3 text-center', 'ไม่มีงานแจ้งซ่อมบำรุง SAP ค้างส่งต่อค่ะ'));
      } else {
        for (const m of digest.pendingSap) {
          const row = el('div', 'sa-card p-2 text-xs flex flex-col gap-1');
          row.append(
            el('div', 'font-bold text-brand flex items-center justify-between', `SAP #${m.sapNo || '-'}`),
            el('div', 'text-secondary', `[สถานะ: ${m.status || 'REL'}]: ${m.detail || '-'}`)
          );
          p4Content.appendChild(row);
        }
      }
    }

    // Preview Formatting
    const previewEl = document.getElementById('handover-formatted-preview');
    if (previewEl) {
      previewEl.textContent = LogbookParser.formatShiftHandoverText(digest);
    }
  }
};
