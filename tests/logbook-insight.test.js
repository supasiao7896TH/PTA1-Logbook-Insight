import { describe, it, expect } from 'vitest';
import { LogbookParser } from '../src/modules/logbook-parser.js';

describe('PTA1 Logbook Insight — Business Logic Suite', () => {
  describe('1. Equipment Tag Extraction (extractTags)', () => {
    it('extracts standard PTA1 equipment and instrument tags without duplicates', () => {
      const line =
        'Found LCV-2302 alarm MV up -> adjust TM-2302F 17->18 sec and dec sequence time TM-2302D 300->250 sec (LCV-2302 normal)';
      const tags = LogbookParser.extractTags(line);
      expect(tags).toEqual(['LCV-2302', 'TM-2302F', 'TM-2302D']);
    });

    it('normalizes tags like FC2602 or PP-404A/B and detects Exapilot keyword', () => {
      const line = 'Stop PP-404A for NaOH washing by Exapilot due to LCV-2404A MV 100%';
      const tags = LogbookParser.extractTags(line);
      expect(tags).toContain('PP-404A');
      expect(tags).toContain('LCV-2404A');
      expect(tags).toContain('EXAPILOT');
    });
  });

  describe('2. Smart Log Search & Filtering (filterEntries)', () => {
    const sampleEntries = [
      {
        id: '2026-10-13-N-136',
        monthKey: '2026-10',
        day: '13',
        shift: 'Night',
        fm: 'A กฤษณะ',
        bm: 'C ศุภสิทธิ์',
        category: 'DW',
        text: 'Found LCV-2302 alarm MV up -> adjust TM-2302F 17->18 sec and TM-2302D 300->250 sec',
        tags: ['LCV-2302', 'TM-2302F', 'TM-2302D']
      },
      {
        id: '2026-10-14-N-125',
        monthKey: '2026-10',
        day: '14',
        shift: 'Night',
        fm: 'D อดุลย์',
        bm: 'D เพชร',
        category: 'DW',
        text: 'Found PI-2105 high 277 mmH2O cut transfer FC-1401 5 min',
        tags: ['PI-2105', 'FC-1401']
      },
      {
        id: '2026-09-20-D-80',
        monthKey: '2026-09',
        day: '20',
        shift: 'Day',
        fm: 'C ชาญชัช',
        bm: 'C ศุภสิทธิ์',
        category: 'DW',
        text: 'Stop PP-404A for NaOH washing by Exapilot',
        tags: ['PP-404A', 'EXAPILOT']
      }
    ];

    it('filters by Boardman (BM), monthKey, shift, tag, and case-insensitive search query', () => {
      const byBm = LogbookParser.filterEntries(sampleEntries, { bm: 'C ศุภสิทธิ์' });
      expect(byBm).toHaveLength(2);

      const byTagAndMonth = LogbookParser.filterEntries(sampleEntries, {
        monthKey: '2026-10',
        tag: 'LCV-2302'
      });
      expect(byTagAndMonth).toHaveLength(1);
      expect(byTagAndMonth[0].id).toBe('2026-10-13-N-136');

      const byQuery = LogbookParser.filterEntries(sampleEntries, {
        query: 'tm-2302d'
      });
      expect(byQuery).toHaveLength(1);
      expect(byQuery[0].day).toBe('13');
    });
  });

  describe('3. Monthly Shift Insights & Chronic Issue Detection (computeInsights)', () => {
    it('counts top equipment tags and detects shifts exceeding 4-CBA > 15.0 ppm target', () => {
      const entries = [
        { monthKey: '2026-10', day: '02', shift: 'Night', bm: 'A สถิตย์', text: 'Cut FC-1401 due to PI-2105', tags: ['FC-1401', 'PI-2105'] },
        { monthKey: '2026-10', day: '05', shift: 'Night', bm: 'C ศุภสิทธิ์', text: 'PI-2105 high 288 mmH2O', tags: ['PI-2105'] },
        { monthKey: '2026-10', day: '09', shift: 'Day', bm: 'C ศุภสิทธิ์', text: 'PP-404A NaOH washing', tags: ['PP-404A'] }
      ];
      const daysSummary = [
        { monthKey: '2026-10', day: '02', dayCba: 11.36, nightCba: 12.76, dayLoad: 102, nightLoad: 102, prod: 1376.9, dayBm: 'D เพชร', nightBm: 'A สถิตย์' },
        { monthKey: '2026-10', day: '05', dayCba: 14.34, nightCba: 15.47, dayLoad: 98, nightLoad: 99, prod: 1329.3, dayBm: 'B ฐาณันตร์', nightBm: 'C ศุภสิทธิ์' },
        { monthKey: '2026-10', day: '09', dayCba: 15.36, nightCba: 15.10, dayLoad: 98, nightLoad: 100, prod: 1344.2, dayBm: 'C ศุภสิทธิ์', nightBm: 'D เพชร' }
      ];

      const insight = LogbookParser.computeInsights(entries, daysSummary);
      expect(insight.topTags[0]).toEqual({ tag: 'PI-2105', count: 2 });
      expect(insight.cbaExceedCount).toBe(3); // 15.47, 15.36, 15.10
      expect(insight.bmShiftCount['C ศุภสิทธิ์']).toBe(2);
    });
  });

  describe('4. IPS Benefit Formula 1.1 & HCL Notes Formatting', () => {
    it('calculates total monthly benefit strictly by formula (1) + (2) - (4/12) - (5)', () => {
      const calc = LogbookParser.calculateIpsBenefit({
        costSaving: 1500,
        manHours: 4,
        hourlyRate: 300,
        oppLossTons: 10,
        tonRate: 2000,
        investYear: 1200,
        extraCost: 200
      });

      expect(calc.manHourSaving).toBe(1200);
      expect(calc.oppLossSaving).toBe(20000);
      expect(calc.investMonthly).toBe(100);
      expect(calc.totalMonthly).toBe(2400);
    });

    it('formats IPS Draft with mandatory HCL Notes sections', () => {
      const text = LogbookParser.formatIpsDraft({
        jobName: 'การปรับปรุงการควบคุมวาล์ว LCV-2302',
        caseName: 'ปรับจูน TM-2302F และ TM-2302D',
        section: 'PE1',
        objective: 'เพิ่ม Reliability',
        kaizenWay: '3.Modification',
        beforeText: 'พบปัญหา LCV-2302 Alarm MV Up ซ้ำ',
        afterText: 'ปรับ TM-2302F 17->18 sec และ TM-2302D 300->250 sec',
        effectText: 'ไม่พบ Alarm ซ้ำอีกเลย'
      });

      expect(text).toContain('📋 IPS DRAFT — Individual Kaizen (GC-M PTA)');
      expect(text).toContain('❌ ก่อนการปรับปรุง (Before improvement)');
      expect(text).toContain('✅ หลังการปรับปรุง (After improvement)');
      expect(text).toContain('📈 ประสิทธิภาพหลังการปฏิบัติ (Effectiveness after improvement)');
    });
  });

  describe('5. Silo Operations & Switching Tracking (filterSiloOperations)', () => {
    const sampleSiloOps = [
      {
        id: 'silo-2026-10-01-52',
        date: '2026-10-01',
        monthKey: '2026-10',
        time: '12:00',
        shift: 'Day',
        switchText: 'B to A',
        destination: 'B to PTK810A',
        description: ''
      },
      {
        id: 'silo-2026-10-03-51',
        date: '2026-10-03',
        monthKey: '2026-10',
        time: '07:50',
        shift: 'Day',
        switchText: '',
        destination: 'A to 820A',
        description: '810A full'
      },
      {
        id: 'silo-2026-10-03-53',
        date: '2026-10-03',
        monthKey: '2026-10',
        time: '16:10',
        shift: 'Day',
        switchText: 'A to B',
        destination: 'A to PTK810A',
        description: ''
      }
    ];

    it('filters Silo operations by target silo, destination, and text query', () => {
      const for820A = LogbookParser.filterSiloOperations(sampleSiloOps, { silo: '820A' });
      expect(for820A).toHaveLength(1);
      expect(for820A[0].description).toBe('810A full');

      const forSiloB = LogbookParser.filterSiloOperations(sampleSiloOps, { silo: 'B' });
      expect(forSiloB).toHaveLength(2);

      const byQuery = LogbookParser.filterSiloOperations(sampleSiloOps, { query: 'full' });
      expect(byQuery).toHaveLength(1);
    });
  });

  describe('6. SAP & Maintenance Handover Memos (filterSapMemos)', () => {
    const sampleMemos = [
      {
        id: 'sap-2026-10-03-65',
        date: '2026-10-03',
        monthKey: '2026-10',
        sapNo: '',
        detail: 'PD-2500 = 1.82 kg/cm2 pls replace filter of PM-500B.',
        status: 'REL',
        remark: ''
      },
      {
        id: 'sap-2026-10-05-62',
        date: '2026-10-05',
        monthKey: '2026-10',
        sapNo: '10045621',
        detail: 'Check PP-503A mech seal leak',
        status: 'Completed',
        remark: 'F/O check'
      }
    ];

    it('filters SAP memos by equipment tag, status, and query', () => {
      const pm500 = LogbookParser.filterSapMemos(sampleMemos, { query: 'PM-500B' });
      expect(pm500).toHaveLength(1);
      expect(pm500[0].date).toBe('2026-10-03');

      const completed = LogbookParser.filterSapMemos(sampleMemos, { status: 'Completed' });
      expect(completed).toHaveLength(1);
      expect(completed[0].sapNo).toBe('10045621');
    });
  });

  describe('7. PM-901 High Pressure & Chemical Washing Routine (filterWashingRoutines)', () => {
    const sampleWash = [
      {
        id: 'wash-2026-10-01-D',
        date: '2026-10-01',
        monthKey: '2026-10',
        shift: 'Day',
        bm: 'D เพชร',
        fm: 'B โสภณ',
        hpTime: '13:40',
        washNo: 'No. 2',
        washNoNum: 2,
        batchCount: 28,
        pp404Target: 'PP-404B',
        pp404Time: '13:43',
        naohPj404: '',
        naohMlLine: '',
        naohLi2901: true,
        naohPm901Time: '14:13',
        pm901StartTime: '15:44',
        durationMin: 124,
        requestCta: 'No'
      },
      {
        id: 'wash-2026-10-03-D',
        date: '2026-10-03',
        monthKey: '2026-10',
        shift: 'Day',
        bm: 'B ฐาณันตร์',
        fm: 'A กฤษณะ',
        hpTime: '09:17',
        washNo: 'No. 3',
        washNoNum: 3,
        batchCount: 30,
        pp404Target: 'PP-404A',
        pp404Time: '10:00',
        naohPj404: '09:25',
        naohMlLine: '09:20',
        naohLi2901: false,
        naohPm901Time: '10:08',
        pm901StartTime: '11:40',
        durationMin: 143,
        requestCta: 'No'
      },
      {
        id: 'wash-2026-10-04-N',
        date: '2026-10-04',
        monthKey: '2026-10',
        shift: 'Night',
        bm: 'C ศุภสิทธิ์',
        fm: 'A กฤษณะ',
        hpTime: '00:30',
        washNo: 'No. 4',
        washNoNum: 4,
        batchCount: 27,
        pp404Target: 'PP-404B',
        pp404Time: '00:36',
        naohPj404: '',
        naohMlLine: '',
        naohLi2901: false,
        naohPm901Time: '01:03',
        pm901StartTime: '02:35',
        durationMin: 125,
        requestCta: 'No'
      }
    ];

    it('filters washing routines by equipment (PP-404A, PP-404B, PJ-404, PM-901, LI-2901) strictly when time is recorded', () => {
      const pp404b = LogbookParser.filterWashingRoutines(sampleWash, { equipment: 'PP-404B' });
      expect(pp404b).toHaveLength(2);

      const pp404a = LogbookParser.filterWashingRoutines(sampleWash, { equipment: 'PP-404A' });
      expect(pp404a).toHaveLength(1);
      expect(pp404a[0].date).toBe('2026-10-03');

      const pj404 = LogbookParser.filterWashingRoutines(sampleWash, { equipment: 'PJ-404' });
      expect(pj404).toHaveLength(1);
      expect(pj404[0].date).toBe('2026-10-03');
      expect(pj404[0].naohPj404).toBe('09:25');

      const li2901 = LogbookParser.filterWashingRoutines(sampleWash, { equipment: 'LI-2901' });
      expect(li2901).toHaveLength(1);
      expect(li2901[0].id).toBe('wash-2026-10-01-D');
    });

    it('filters by washNo, monthKey, and search query (e.g. Boardman name or batch)', () => {
      const byWashNo = LogbookParser.filterWashingRoutines(sampleWash, { washNo: 'No. 4' });
      expect(byWashNo).toHaveLength(1);
      expect(byWashNo[0].bm).toBe('C ศุภสิทธิ์');

      const byBmQuery = LogbookParser.filterWashingRoutines(sampleWash, { query: 'ศุภสิทธิ์' });
      expect(byBmQuery).toHaveLength(1);
      expect(byBmQuery[0].batchCount).toBe(27);

      const byBatchCount = LogbookParser.filterWashingRoutines(sampleWash, { query: '30' });
      expect(byBatchCount).toHaveLength(1);
      expect(byBatchCount[0].date).toBe('2026-10-03');
    });

    it('correctly calculates washing duration in minutes and formats human time', () => {
      const duration = LogbookParser.calculateWashingDuration('13:40', '15:44');
      expect(duration).toBe(124);

      const crossMidnight = LogbookParser.calculateWashingDuration('23:10', '00:45');
      expect(crossMidnight).toBe(95);

      const text = LogbookParser.formatDurationMinutes(124);
      expect(text).toBe('2 ชม. 4 นาที');
    });
  });

  describe('8. Regular Work Routine Tracking (filterRegularWorkRoutines)', () => {
    const sampleRegularWork = [
      {
        id: 'rw-2026-10-01-38',
        date: '2026-10-01',
        monthKey: '2026-10',
        time: '16:56',
        shift: 'Day',
        bm: 'D เพชร',
        fm: 'B โสภณ',
        row: 38,
        taskKey: 'LCV-2301-3',
        taskTitle: '- Check LCV-2301-3 (Every 1,16) LCV-2301 = 6 sec open = 40 %, LCV-2302 =14 sec open = 70 %, LCV-2303 = 14 sec open = 100 %',
        taskSchedule: 'Every 1,16',
        note: '[ทำแล้ว] 16:56',
        valueDetail: 'LCV-2301 = 6 sec open = 40 %, LCV-2302 =14 sec open = 70 %, LCV-2303 = 14 sec open = 100 %',
        tags: ['LCV-2301', 'LCV-2302', 'LCV-2303']
      },
      {
        id: 'rw-2026-10-17-31',
        date: '2026-10-17',
        monthKey: '2026-10',
        time: '16:10',
        shift: 'Day',
        bm: 'B ฐาณันตร์',
        fm: 'A กฤษณะ',
        row: 31,
        taskKey: 'PZ-601',
        taskTitle: '- Drain Light oil PZ-601 = __30__ Lite(Every sat. of week)',
        taskSchedule: 'Every sat. of week',
        note: '[ทำแล้ว] 16:10',
        valueDetail: '30 Lite',
        tags: ['PZ-601']
      },
      {
        id: 'rw-2026-10-10-32',
        date: '2026-10-10',
        monthKey: '2026-10',
        time: '15:55',
        shift: 'Day',
        bm: 'C ศุภสิทธิ์',
        fm: 'B โสภณ',
        row: 32,
        taskKey: 'PT-501-BD',
        taskTitle: '- Blow down PT-501 (Every 5,10,15,20,25,30 of month)',
        taskSchedule: 'Every 5,10,15,20,25,30 of month',
        note: '[ทำแล้ว] 15:55',
        valueDetail: '',
        tags: ['PT-501']
      }
    ];

    it('filters regular work routines by taskKey (PZ-601, LCV-2301-3, PT-501-BD, etc.)', () => {
      const pz = LogbookParser.filterRegularWorkRoutines(sampleRegularWork, { taskKey: 'PZ-601' });
      expect(pz).toHaveLength(1);
      expect(pz[0].valueDetail).toBe('30 Lite');

      const lcv = LogbookParser.filterRegularWorkRoutines(sampleRegularWork, { taskKey: 'LCV-2301-3' });
      expect(lcv).toHaveLength(1);
      expect(lcv[0].date).toBe('2026-10-01');
    });

    it('filters regular work routines by monthKey, Boardman, and text query', () => {
      const supasit = LogbookParser.filterRegularWorkRoutines(sampleRegularWork, { query: 'ศุภสิทธิ์' });
      expect(supasit).toHaveLength(1);
      expect(supasit[0].taskKey).toBe('PT-501-BD');

      const byValue = LogbookParser.filterRegularWorkRoutines(sampleRegularWork, { query: '30 Lite' });
      expect(byValue).toHaveLength(1);
      expect(byValue[0].id).toBe('rw-2026-10-17-31');
    });
  });

  describe('9. Auto-Sync & Watcher Helpers (isIgnoredLogbookFile, isNewerTimestamp)', () => {
    it('ignores temporary Excel lock files (~$*.xlsx), temp files, and system files', () => {
      expect(LogbookParser.isIgnoredLogbookFile('~$01_Log_Sheet_Jan_2026.xlsx')).toBe(true);
      expect(LogbookParser.isIgnoredLogbookFile('~$10_Log_Sheet_Oct_2026.xlsm')).toBe(true);
      expect(LogbookParser.isIgnoredLogbookFile('cache.tmp')).toBe(true);
      expect(LogbookParser.isIgnoredLogbookFile('Thumbs.db')).toBe(true);
      expect(LogbookParser.isIgnoredLogbookFile('.DS_Store')).toBe(true);

      // Legitimate Logbook files
      expect(LogbookParser.isIgnoredLogbookFile('01_Log_Sheet_Jan_2026.xlsx')).toBe(false);
      expect(LogbookParser.isIgnoredLogbookFile('02_Log_Sheet_Feb_2026.xlsm')).toBe(false);
      expect(LogbookParser.isIgnoredLogbookFile('10_Log_Sheet_Oct_2026.xlsx')).toBe(false);
    });

    it('correctly compares ISO timestamps to detect incoming newer data', () => {
      const cur = '2026-10-23T05:00:00.000Z';
      const newer = '2026-10-23T06:00:00.000Z';
      const older = '2026-10-23T04:00:00.000Z';

      expect(LogbookParser.isNewerTimestamp(cur, newer)).toBe(true);
      expect(LogbookParser.isNewerTimestamp(cur, older)).toBe(false);
      expect(LogbookParser.isNewerTimestamp(cur, cur)).toBe(false);
      expect(LogbookParser.isNewerTimestamp(null, newer)).toBe(true);
      expect(LogbookParser.isNewerTimestamp(cur, null)).toBe(false);
    });

    it('returns false when incoming timestamp is identical, older, or invalid', () => {
      const cur = '2026-10-23T11:12:20.286Z';
      expect(LogbookParser.isNewerTimestamp(cur, cur)).toBe(false);
      expect(LogbookParser.isNewerTimestamp(cur, 'invalid-date')).toBe(false);
      expect(LogbookParser.isNewerTimestamp(cur, '2026-10-23T11:12:19.000Z')).toBe(false);
    });
  });

  describe('10. Plant Operational Chronology (07:30-19:30 Day / 19:30-07:30 Night)', () => {
    it('calculates continuous 24-hr plant timeline minutes from 07:30 Day shift to 07:30 Night shift', () => {
      // Day Shift (07:30 - 19:30)
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Day', '07:30'))).toBe(0);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Day', '07:48'))).toBe(18);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Day', '08:45'))).toBe(75);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Day', '11:36'))).toBe(246);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Day', '17:00'))).toBe(570);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Day', '19:30'))).toBe(720);

      // Night Shift (19:30 - 07:30 next morning)
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Night', '19:30'))).toBe(720);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Night', '21:00'))).toBe(810);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Night', '23:00'))).toBe(930);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Night', '00:16'))).toBe(1006);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Night', '01:28'))).toBe(1078);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Night', '06:00'))).toBe(1350);
      expect(Math.floor(LogbookParser.getShiftTimelineMinute('Night', '07:30'))).toBe(1440);
    });

    it('correctly sorts cross-table logbook entries (QC vs DW) without time jumping back and forth', () => {
      const items = [
        { id: '1', date: '2026-10-23', shift: 'Day', row: 14, time: '11:36', text: 'QC LC-2301' },
        { id: '2', date: '2026-10-23', shift: 'Day', row: 78, time: '07:48', text: 'DW Cut transfer' },
        { id: '3', date: '2026-10-23', shift: 'Day', row: 83, time: '08:45', text: 'DW Stop PP-404A' },
        { id: '4', date: '2026-10-23', shift: 'Day', row: 87, time: '13:28', text: 'DW Start PP-603' },
        { id: '5', date: '2026-10-23', shift: 'Night', row: 142, time: '21:00', text: 'DW RPF torque' },
        { id: '6', date: '2026-10-23', shift: 'Night', row: 145, time: '00:16', text: 'DW PD-405 level' }
      ];

      // Ascending (Chronological morning to night): 07:48 -> 08:45 -> 11:36 -> 13:28 -> 21:00 -> 00:16
      const asc = [...items].sort((a, b) => LogbookParser.compareLogChronology(a, b, 'asc'));
      expect(asc.map((x) => x.time)).toEqual(['07:48', '08:45', '11:36', '13:28', '21:00', '00:16']);

      // Descending (Newest first): 00:16 -> 21:00 -> 13:28 -> 11:36 -> 08:45 -> 07:48
      const desc = [...items].sort((a, b) => LogbookParser.compareLogChronology(a, b, 'desc'));
      expect(desc.map((x) => x.time)).toEqual(['00:16', '21:00', '13:28', '11:36', '08:45', '07:48']);
    });
  });

  describe('11. Storage Engine Data Export & Import (PC Migration Backup & Restore)', () => {
    it('validates backup JSON structure and restores drafts successfully', async () => {
      const { StorageEngine } = await import('../src/modules/storage-engine.js');
      const backupJson = JSON.stringify({
        appName: 'PTA1 Logbook Insight',
        version: '1.0.0',
        exportedAt: '2026-10-23T15:00:00.000Z',
        theme: 'light',
        ipsDrafts: [
          { id: 'draft-test-1', jobName: 'แก้ไขท่อระบายน้ำ', date: '2026-10-23' },
          { id: 'draft-test-2', jobName: 'ปรับจูน Exapilot LCV-2302', date: '2026-10-22' }
        ],
        customMonths: [
          { monthKey: '2026-11', monthMeta: { label: 'พ.ย. 2026' } }
        ]
      });

      const result = await StorageEngine.importAllData(backupJson);
      expect(result.draftsImported).toBe(2);
      expect(result.monthsImported).toBe(1);

      const exported = await StorageEngine.exportAllData();
      const parsed = JSON.parse(exported);
      expect(parsed.appName).toBe('PTA1 Logbook Insight');
      expect(parsed.version).toBe('1.0.0');
      expect(Array.isArray(parsed.ipsDrafts)).toBe(true);
    });
  });

  describe('12. Bad Actor Pareto & Reliability Intelligence (computeParetoBadActors)', () => {
    const mockEntries = [
      { id: '1', date: '2026-10-01', tags: ['LCV-2302'], text: 'LCV-2302 passing 10%' },
      { id: '2', date: '2026-10-05', tags: ['LCV-2302'], text: 'LCV-2302 valve hunt' },
      { id: '3', date: '2026-10-10', tags: ['LCV-2302'], text: 'LCV-2302 check gland' },
      { id: '4', date: '2026-10-15', tags: ['LCV-2302'], text: 'LCV-2302 auto trip' },
      { id: '5', date: '2026-10-02', tags: ['PP-404A'], text: 'PP-404A high vibration' },
      { id: '6', date: '2026-10-08', tags: ['PP-404A'], text: 'PP-404A switch to B' },
      { id: '7', date: '2026-10-14', tags: ['PP-404A'], text: 'PP-404A mech seal leak' },
      { id: '8', date: '2026-10-03', tags: ['PM-500B'], text: 'PM-500B filter dirty' },
      { id: '9', date: '2026-10-11', tags: ['PM-500B'], text: 'PM-500B high dp' },
      { id: '10', date: '2026-10-04', tags: ['TTK-400'], text: 'TTK-400 full high level' }
    ];

    const mockSapMemos = [
      { id: 'sap-1', sapNo: '1001', detail: 'LCV-2302 gland packing leak', status: 'REL' },
      { id: 'sap-2', sapNo: '1002', detail: 'PP-404A bearing replacement', status: 'Completed' }
    ];

    it('calculates Pareto 80/20 distribution, cumulative percentage, and MTBF intervals correctly', () => {
      const result = LogbookParser.computeParetoBadActors(mockEntries, {
        sapMemos: mockSapMemos,
        referenceDate: '2026-10-20'
      });

      expect(result.totalIncidents).toBe(10);
      expect(result.items).toHaveLength(4);

      // Top 1: LCV-2302 with 4 incidents (40%)
      const top1 = result.items[0];
      expect(top1.tag).toBe('LCV-2302');
      expect(top1.count).toBe(4);
      expect(top1.percentage).toBe(40);
      expect(top1.cumulativePercentage).toBe(40);
      expect(top1.isPareto80).toBe(true);
      expect(top1.unit).toBe('Purification');
      expect(top1.firstSeen).toBe('2026-10-01');
      expect(top1.lastSeen).toBe('2026-10-15');
      expect(top1.avgDaysBetween).toBe(4.7); // (14 days) / (3 intervals) = 4.67 -> 4.7
      expect(top1.daysSinceLast).toBe(5); // 2026-10-20 - 2026-10-15 = 5
      expect(top1.relatedSapCount).toBe(1);
      expect(top1.relatedSapMemos[0].sapNo).toBe('1001');

      // Top 2: PP-404A with 3 incidents (30%) -> Cumulative 70%
      const top2 = result.items[1];
      expect(top2.tag).toBe('PP-404A');
      expect(top2.count).toBe(3);
      expect(top2.cumulativePercentage).toBe(70);
      expect(top2.isPareto80).toBe(true);
      expect(top2.unit).toBe('Reaction');

      // Top 3: PM-500B with 2 incidents (20%) -> Cumulative 90% (Crosses 80% cutoff)
      const top3 = result.items[2];
      expect(top3.tag).toBe('PM-500B');
      expect(top3.cumulativePercentage).toBe(90);
      expect(top3.isPareto80).toBe(true); // included as the critical cutoff boundary

      // Top 4: TTK-400 with 1 incident (10%) -> Cumulative 100%
      const top4 = result.items[3];
      expect(top4.tag).toBe('TTK-400');
      expect(top4.isPareto80).toBe(false);
      expect(top4.unit).toBe('Silo');
    });

    it('filters bad actors by unit and minIncidents', () => {
      const reactionOnly = LogbookParser.computeParetoBadActors(mockEntries, {
        unitFilter: 'Reaction'
      });
      expect(reactionOnly.items).toHaveLength(1);
      expect(reactionOnly.items[0].tag).toBe('PP-404A');

      const min3Incidents = LogbookParser.computeParetoBadActors(mockEntries, {
        minIncidents: 3
      });
      expect(min3Incidents.items).toHaveLength(2);
      expect(min3Incidents.items.map((x) => x.tag)).toEqual(['LCV-2302', 'PP-404A']);
    });
  });

  describe('13. Smart Shift Handover Digest (generateShiftHandoverDigest & formatShiftHandoverText)', () => {
    const mockShiftEntries = [
      {
        id: '2026-10-23-23-D-QC-14',
        date: '2026-10-23',
        day: '23',
        shift: 'Day',
        bm: 'C ศุภสิทธิ์',
        fm: 'D อดุลย์',
        cba: 12.5,
        load: 85.0,
        prod: 920.0,
        category: 'QC',
        row: 14,
        time: '11:36',
        text: 'LC-2301 check level stable',
        tags: ['LC-2301']
      },
      {
        id: '2026-10-23-23-D-DW-78',
        date: '2026-10-23',
        day: '23',
        shift: 'Day',
        bm: 'C ศุภสิทธิ์',
        fm: 'D อดุลย์',
        cba: 12.5,
        load: 85.0,
        prod: 920.0,
        category: 'DW',
        row: 78,
        time: '07:48',
        text: 'Cut transfer powder to silo B',
        tags: ['SILO', 'TRANSFER']
      },
      {
        id: '2026-10-23-23-D-DW-83',
        date: '2026-10-23',
        day: '23',
        shift: 'Day',
        bm: 'C ศุภสิทธิ์',
        fm: 'D อดุลย์',
        cba: 12.5,
        load: 85.0,
        prod: 920.0,
        category: 'DW',
        row: 83,
        time: '12:00',
        text: 'LCV-2302 valve hunt 40-70%',
        tags: ['LCV-2302']
      }
    ];

    const mockSilo = [
      {
        id: 'silo-1',
        date: '2026-10-23',
        time: '12:00',
        shift: 'Day',
        bm: 'C ศุภสิทธิ์',
        fm: 'D อดุลย์',
        switchText: 'B to A',
        destination: 'B to PTK810A',
        description: 'transfer normal'
      }
    ];

    const mockWash = [
      {
        id: 'wash-1',
        date: '2026-10-22',
        shift: 'Night',
        bm: 'B ฐาณันตร์',
        fm: 'B เฉลิมพล',
        washNo: 'No. 5',
        batchCount: 28,
        durationMin: 120
      }
    ];

    const mockSap = [
      {
        id: 'sap-1',
        date: '2026-10-23',
        sapNo: '10045688',
        detail: 'Check LCV-2302 gland packing leak',
        status: 'REL'
      }
    ];

    it('extracts all 4 handover pillars with correct Boardman (B/M) and Foreman (F/M)', () => {
      const digest = LogbookParser.generateShiftHandoverDigest(mockShiftEntries, {
        date: '2026-10-23',
        shift: 'Day',
        siloOperations: mockSilo,
        washingRoutines: mockWash,
        sapMemos: mockSap
      });

      expect(digest.date).toBe('2026-10-23');
      expect(digest.shift).toBe('Day');
      expect(digest.bm).toBe('C ศุภสิทธิ์');
      expect(digest.fm).toBe('D อดุลย์');
      expect(digest.avgLoad).toBe(85.0);
      expect(digest.avgCba).toBe(12.5);

      // Pillar 1: Key Operations & Incidents
      expect(digest.keyEvents).toHaveLength(3);
      expect(digest.keyTags).toContain('LCV-2302');

      // Pillar 2: Silo & Logistics Status
      expect(digest.siloEvents).toHaveLength(1);
      expect(digest.siloEvents[0].switchText).toBe('B to A');
      expect(digest.siloEvents[0].destination).toBe('B to PTK810A');

      // Pillar 3: Washing Status
      expect(digest.washingStatus.performedInShift).toBe(false);
      expect(digest.washingStatus.lastWashDate).toBe('2026-10-22');

      // Pillar 4: Pending SAP Memos
      expect(digest.pendingSap).toHaveLength(1);
      expect(digest.pendingSap[0].sapNo).toBe('10045688');

      // Formatted text test
      const formatted = LogbookParser.formatShiftHandoverText(digest);
      expect(formatted).toContain('B/M (Boardman): C ศุภสิทธิ์');
      expect(formatted).toContain('F/M (Foreman): D อดุลย์');
      expect(formatted).toContain('B to PTK810A');
      expect(formatted).toContain('LCV-2302');
    });
  });
});
