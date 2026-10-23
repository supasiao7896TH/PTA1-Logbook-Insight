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
        costSaving: 1500,       // (1) 1,500 THB/month
        manHours: 4,            // (2) 4 hrs/month
        hourlyRate: 300,        //     x 300 THB/hr = 1,200 THB/month
        oppLossTons: 10,        // (3) 10 Tons (tracked separately, not in 1+2-4-5 sum)
        tonRate: 2000,          //     x 2,000 = 20,000 THB/month
        investYear: 1200,       // (4) 1,200 THB/year -> 100 THB/month
        extraCost: 200          // (5) 200 THB/month
      });

      expect(calc.manHourSaving).toBe(1200);
      expect(calc.oppLossSaving).toBe(20000);
      expect(calc.investMonthly).toBe(100);
      // Total = 1500 + 1200 - 100 - 200 = 2400
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
});
