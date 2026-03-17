// ===== 画面8：月次勤務レポート =====
const ReportScreen = (() => {
  let currentYear, currentMonth, filterStaffId = 'all';

  function init() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
  }

  async function render() {
    if (currentYear === undefined) init();
    const container = document.getElementById('screen-report');
    const staff = await Storage.getStaff();
    const period = Utils.getPayPeriod(currentYear, currentMonth);
    const records = await Storage.getTimeRecordsByRange(period.start, period.end);

    const filteredStaff = filterStaffId === 'all' ? staff : staff.filter(s => s.id === filterStaffId);

    // レポートデータ作成
    const reports = [];
    for (const s of filteredStaff) {
      const staffRecords = records.filter(r => r.staffId === s.id);
      const dates = [...new Set(staffRecords.map(r => r.date))].sort();
      const dayWorks = dates.map(date => Calc.calcDayWork(records, s.id, date));
      const pay = Calc.calcMonthlyPay(s, dayWorks);
      reports.push({ staff: s, dayWorks, pay });
    }

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">月次勤務レポート</h3>
        <div class="flex-between mb-16" style="flex-wrap:wrap;gap:8px;">
          <div class="month-nav" style="margin-bottom:0;">
            <button class="btn btn-sm btn-secondary" id="rpt-prev">&lt;</button>
            <span class="month-label">${currentYear}年${currentMonth+1}月</span>
            <button class="btn btn-sm btn-secondary" id="rpt-next">&gt;</button>
          </div>
          <div class="form-inline">
            <select class="form-select" id="rpt-staff-filter" style="width:auto;">
              <option value="all">全スタッフ</option>
              ${staff.map(s => `<option value="${s.id}" ${filterStaffId===s.id?'selected':''}>${Utils.escapeHtml(s.name)}</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-primary no-print" id="rpt-pdf">PDF出力</button>
          </div>
        </div>
        <p style="color:var(--text-light);font-size:0.85rem;margin-bottom:16px;">
          対象期間：${period.start} 〜 ${period.end}
        </p>
      </div>

      ${reports.map(rpt => `
        <div class="card">
          <h3 class="card-title">${Utils.escapeHtml(rpt.staff.name)} - 月次サマリー</h3>
          <div class="summary-grid" style="margin-bottom:16px;">
            <div class="summary-card">
              <h3>出勤日数</h3>
              <div class="value">${rpt.pay.workDays}日</div>
            </div>
            <div class="summary-card">
              <h3>総労働時間</h3>
              <div class="value">${Utils.minutesToHMJP(rpt.pay.totalWorkMinutes)}</div>
            </div>
            <div class="summary-card">
              <h3>深夜時間</h3>
              <div class="value">${Utils.minutesToHMJP(rpt.pay.totalNightMinutes)}</div>
            </div>
            <div class="summary-card">
              <h3>支給合計</h3>
              <div class="value">${Utils.formatCurrency(rpt.pay.totalPay)}</div>
            </div>
          </div>

          <h4 style="margin-bottom:8px;">日別勤務記録</h4>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>出勤</th>
                  <th>退勤</th>
                  <th>休憩</th>
                  <th>実働</th>
                  <th>深夜</th>
                  <th>残業</th>
                </tr>
              </thead>
              <tbody>
                ${rpt.dayWorks.filter(dw => dw.isComplete).map(dw => `
                  <tr>
                    <td>${Utils.formatDateJP(dw.date)}</td>
                    <td>${dw.clockIn ? Utils.formatTime(dw.clockIn) : '-'}</td>
                    <td>${dw.clockOut ? Utils.formatTime(dw.clockOut) : '-'}</td>
                    <td class="num">${Utils.minutesToHM(dw.breakMinutes)}</td>
                    <td class="num">${Utils.minutesToHM(dw.workMinutes)}</td>
                    <td class="num">${dw.nightMinutes > 0 ? Utils.minutesToHM(dw.nightMinutes) : '-'}</td>
                    <td class="num">${dw.overtimeMinutes > 0 ? Utils.minutesToHM(dw.overtimeMinutes) : '-'}</td>
                  </tr>
                `).join('')}
                ${rpt.dayWorks.filter(dw => dw.isComplete).length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--text-light);">記録がありません</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    `;

    // イベント
    document.getElementById('rpt-prev').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      render();
    });
    document.getElementById('rpt-next').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      render();
    });
    document.getElementById('rpt-staff-filter').addEventListener('change', (e) => {
      filterStaffId = e.target.value;
      render();
    });
    document.getElementById('rpt-pdf').addEventListener('click', () => generateReportPDF(reports, period));
  }

  function generateReportPDF(reports, period) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });

    doc.setFontSize(16);
    doc.text('Monthly Work Report', 105, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Period: ${period.start} - ${period.end}`, 105, 22, { align: 'center' });

    let y = 30;
    reports.forEach((rpt, idx) => {
      if (idx > 0) { doc.addPage(); y = 20; }

      doc.setFontSize(12);
      doc.text(`${rpt.staff.name}`, 15, y);
      y += 8;

      doc.setFontSize(9);
      doc.text(`Work Days: ${rpt.pay.workDays} | Total: ${Utils.minutesToHM(rpt.pay.totalWorkMinutes)} | Pay: ${rpt.pay.totalPay.toLocaleString()} yen`, 15, y);
      y += 8;

      // テーブル
      const tableData = rpt.dayWorks.filter(dw => dw.isComplete).map(dw => [
        dw.date,
        dw.clockIn ? Utils.formatTime(dw.clockIn) : '-',
        dw.clockOut ? Utils.formatTime(dw.clockOut) : '-',
        Utils.minutesToHM(dw.breakMinutes),
        Utils.minutesToHM(dw.workMinutes),
        dw.nightMinutes > 0 ? Utils.minutesToHM(dw.nightMinutes) : '-',
        dw.overtimeMinutes > 0 ? Utils.minutesToHM(dw.overtimeMinutes) : '-'
      ]);

      if (tableData.length > 0) {
        doc.autoTable({
          startY: y,
          head: [['Date', 'In', 'Out', 'Break', 'Work', 'Night', 'OT']],
          body: tableData,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [74, 144, 217] },
          margin: { left: 15 }
        });
        y = doc.lastAutoTable.finalY + 10;
      }
    });

    doc.save(`report_${period.start}_${period.end}.pdf`);
    Utils.showToast('PDFを出力しました', 'success');
  }

  return { render };
})();
