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
    } else if (activeTab === 'sap') {
      this.renderSapView(handlers);
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

  renderSearchTimeline(handlers) {
    const listEl = document.getElementById('search-results-list');
    const countEl = document.getElementById('search-results-count');
    if (!listEl) return;
    listEl.textContent = '';

    const entries = StateStore.get('entries') || [];
    const filters = StateStore.get('filters');
    const filtered = LogbookParser.filterEntries(entries, filters);

    // Sort newest date first so recent logs appear at top
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || a.row - b.row);

    if (countEl) {
      countEl.textContent = `พบ ${sorted.length.toLocaleString('en-US')} รายการ`;
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
        item.shift === 'Night' ? '🌙 Night (20:00–08:00)' : '☀️ Day (08:00–20:00)'
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
        `BM: ${item.bm || '-'}`
      );
      bmBadge.type = 'button';
      bmBadge.title = 'คลิกเพื่อกรองเฉพาะกะของ Boardman ท่านนี้';
      bmBadge.addEventListener('click', () =>
        handlers.onFilterChange({ bm: filters.bm === item.bm ? 'ALL' : item.bm })
      );

      const fmBadge = el('span', 'badge-person-muted', `FM: ${item.fm || '-'}`);

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
        `📅 ${item.date} (${item.shift}) · คู่กะ FM: ${item.fm || '-'}`
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
    if (!grid) return;
    grid.textContent = '';

    const entries = StateStore.get('entries') || [];
    const filters = StateStore.get('filters');
    const scopedEntries = LogbookParser.filterEntries(entries, {
      monthKey: filters.monthKey
    });

    const insight = LogbookParser.computeInsights(scopedEntries, []);
    const top30 = insight.topTags.slice(0, 30);

    for (const [idx, item] of top30.entries()) {
      const card = el('div', 'sa-card chronic-card');
      const head = el('div', 'chronic-card-head');

      const rankTag = el('div', 'flex items-center gap-2');
      const rankNum = el('span', 'rank-badge', `#${idx + 1}`);
      const tagChip = el('span', 'c-ref-tag', `🏷️ ${item.tag}`);
      rankTag.append(rankNum, tagChip);

      const countBadge = el('span', 'chronic-count', `${item.count} ครั้ง`);
      head.append(rankTag, countBadge);

      const sample = el(
        'p',
        'chronic-sample',
        `ตัวอย่างล่าสุด: "${insight.tagSamples[item.tag] || '-'}"`
      );

      const actions = el('div', 'chronic-actions');
      const inspectBtn = el('button', 'btn-pill-primary', `🔍 ดูประวัติทั้ง ${item.count} ครั้ง`);
      inspectBtn.type = 'button';
      inspectBtn.addEventListener('click', () => {
        handlers.onFilterChange({ tag: item.tag, query: '' });
        handlers.onTabChange('search');
      });

      actions.appendChild(inspectBtn);
      card.append(head, sample, actions);
      grid.appendChild(card);
    }
  },

  renderIpsStudio(handlers) {
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

    // Sort newest date and time first
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));

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
        `BM: ${item.bm || '-'}`
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

    // Sort newest date first, then shift (Night after Day)
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.shift.localeCompare(a.shift));

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
        `BM: ${item.bm || '-'}`
      );
      bmBadge.type = 'button';
      bmBadge.title = 'คลิกเพื่อกรองกะของ Boardman ท่านนี้';
      bmBadge.addEventListener('click', () => {
        handlers.onWashingFilterChange({ query: washFilters.query === item.bm ? '' : item.bm });
      });

      const fmBadge = el('span', 'badge-person-muted', `FM: ${item.fm || '-'}`);

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
  }
};
