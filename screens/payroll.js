// ===== 画面7：給与計算 =====
const PayrollScreen = (() => {
  let currentYear, currentMonth;

  function init() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
  }

  async function render() {
    if (currentYear === undefined) init();
    const container = document.getElementById('screen-payroll');
    const staff = await Storage.getStaff();
    const period = Utils.getPayPeriod(currentYear, currentMonth);
    const records = await Storage.getTimeRecordsByRange(period.start, period.end);

    // スタッフ別給与計算
    const payrolls = [];
    for (const s of staff) {
      const dates = [...new Set(records.filter(r => r.staffId === s.id).map(r => r.date))];
      const dayWorks = dates.map(date => Calc.calcDayWork(records, s.id, date));
      const pay = Calc.calcMonthlyPay(s, dayWorks);
      payrolls.push(pay);
    }

    const payDay = Storage.getSetting('pay_day', '25');
    const payDateStr = `${currentYear}年${currentMonth+1}月${payDay}日`;
    // 締め期間を日本語表示用にパース
    const ps = period.start.split('-');
    const pe = period.end.split('-');
    const periodJP = `${parseInt(ps[0])}年${parseInt(ps[1])}月${parseInt(ps[2])}日〜${parseInt(pe[1])}月${parseInt(pe[2])}日`;

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">給与計算</h3>
        <div class="month-nav">
          <button class="btn btn-sm btn-secondary" id="pay-prev">&lt; 前月</button>
          <span class="month-label">${currentYear}年${currentMonth+1}月 支払分</span>
          <button class="btn btn-sm btn-secondary" id="pay-next">翌月 &gt;</button>
        </div>
        <p style="color:var(--text-light);font-size:0.85rem;text-align:center;margin-bottom:16px;">
          締め期間：${period.start} 〜 ${period.end} ／ 支払日：${currentMonth+1}月${payDay}日
        </p>
      </div>

      <!-- 一覧表 -->
      <div class="card">
        <h3 class="card-title">給与一覧</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>スタッフ</th>
                <th>出勤日数</th>
                <th>総労働</th>
                <th>深夜</th>
                <th>残業</th>
                <th>基本給</th>
                <th>深夜手当</th>
                <th>残業代</th>
                <th>通勤手当</th>
                <th>その他</th>
                <th>総支給</th>
                <th>所得税</th>
                <th>手取り</th>
              </tr>
            </thead>
            <tbody>
              ${payrolls.map(p => `
                <tr>
                  <td>${Utils.escapeHtml(p.staffName)}</td>
                  <td class="num">${p.workDays}日</td>
                  <td class="num">${Utils.minutesToHM(p.totalWorkMinutes)}</td>
                  <td class="num">${Utils.minutesToHM(p.totalNightMinutes)}</td>
                  <td class="num">${Utils.minutesToHM(p.totalOvertimeMinutes)}</td>
                  <td class="num">${Utils.formatCurrency(p.basePay)}</td>
                  <td class="num">${Utils.formatCurrency(p.nightPay)}</td>
                  <td class="num">${Utils.formatCurrency(p.overtimePay)}</td>
                  <td class="num">${Utils.formatCurrency(p.commutePay)}</td>
                  <td class="num">${Utils.formatCurrency(p.otherPay)}</td>
                  <td class="num">${Utils.formatCurrency(p.totalPay)}</td>
                  <td class="num" style="color:var(--danger);">${Utils.formatCurrency(p.incomeTax)}</td>
                  <td class="num"><strong>${Utils.formatCurrency(p.netPay)}</strong></td>
                </tr>
              `).join('')}
              ${payrolls.length === 0 ? '<tr><td colspan="13" style="text-align:center;color:var(--text-light);">データがありません</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 全員PDF一括出力 -->
      <div class="card no-print">
        <div class="btn-group" style="justify-content:center;">
          <button class="btn btn-primary" id="pay-all-pdf">全員の給与明細PDF出力（A4に2名分）</button>
          <button class="btn btn-secondary" id="pay-all-print">全員の給与明細を印刷</button>
        </div>
      </div>

      <!-- 給与明細プレビュー（印刷用含む） -->
      <div id="payslip-preview-area">
        ${payrolls.map((p, idx) => renderPayslipHTML(p, period, periodJP, payDateStr, currentYear, currentMonth, idx)).join('')}
      </div>
    `;

    // 月ナビ
    document.getElementById('pay-prev').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      render();
    });
    document.getElementById('pay-next').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      render();
    });

    // 全員PDF
    document.getElementById('pay-all-pdf').addEventListener('click', () => {
      generateAllPayslipsPDF(payrolls, period, periodJP, payDateStr);
    });

    // 全員印刷
    document.getElementById('pay-all-print').addEventListener('click', () => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('print-target'));
      container.classList.add('print-target');
      window.print();
      container.classList.remove('print-target');
    });

    // 個別PDF/印刷
    container.querySelectorAll('.payslip-pdf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = payrolls.find(pay => pay.staffId === btn.dataset.staff);
        if (p) generateSinglePayslipPDF(p, period, periodJP, payDateStr);
      });
    });
    container.querySelectorAll('.payslip-print-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('print-target'));
        container.classList.add('print-target');
        window.print();
        container.classList.remove('print-target');
      });
    });
  }

  // 給与明細HTML（添付Excel様式準拠）
  function renderPayslipHTML(p, period, periodJP, payDateStr, year, month, index) {
    const taxCatLabel = p.taxCategory === 'otsu' ? '乙欄' : `甲欄（扶養${p.dependents}人）`;
    return `
      <div class="card payslip-card" data-staff="${p.staffId}">
        <div class="payslip-new" id="payslip-${p.staffId}">
          <!-- ヘッダー -->
          <div class="ps-header">
            <h3 class="ps-title">給 料 明 細 書</h3>
            <div class="ps-period">${year}年${month+1}月分給与（${periodJP}）</div>
          </div>

          <!-- 氏名 -->
          <div class="ps-name">
            氏　名　<strong>${Utils.escapeHtml(p.staffName)}</strong>　様
          </div>

          <!-- 2カラムレイアウト -->
          <div class="ps-columns">
            <!-- 左列：勤怠・支給 -->
            <div class="ps-col">
              <table class="ps-table">
                <thead>
                  <tr><th colspan="2" class="ps-section-header">勤 怠</th></tr>
                </thead>
                <tbody>
                  <tr><td>出勤日数</td><td class="ps-val">${p.workDays} 日</td></tr>
                  <tr><td>労働時間</td><td class="ps-val">${Utils.minutesToHM(p.totalWorkMinutes)}</td></tr>
                  <tr><td>残業時間</td><td class="ps-val">${Utils.minutesToHM(p.totalOvertimeMinutes)}</td></tr>
                  <tr><td>深夜労働時間</td><td class="ps-val">${Utils.minutesToHM(p.totalNightMinutes)}</td></tr>
                </tbody>
                <thead>
                  <tr><th colspan="2" class="ps-section-header">支 給</th></tr>
                </thead>
                <tbody>
                  <tr><td>基本給</td><td class="ps-val">${Utils.formatCurrency(p.basePay)}</td></tr>
                  <tr><td>残業手当</td><td class="ps-val">${Utils.formatCurrency(p.overtimePay)}</td></tr>
                  <tr><td>深夜手当</td><td class="ps-val">${Utils.formatCurrency(p.nightPay)}</td></tr>
                  <tr><td>通勤手当</td><td class="ps-val">${Utils.formatCurrency(p.commutePay)}</td></tr>
                  <tr><td>手当・その他</td><td class="ps-val">${Utils.formatCurrency(p.otherPay)}</td></tr>
                  <tr class="ps-total-row"><td><strong>総支給合計</strong></td><td class="ps-val"><strong>${Utils.formatCurrency(p.totalPay)}</strong></td></tr>
                </tbody>
              </table>
            </div>

            <!-- 右列：控除 -->
            <div class="ps-col">
              <table class="ps-table">
                <thead>
                  <tr><th colspan="2" class="ps-section-header">控 除</th></tr>
                </thead>
                <tbody>
                  <tr><td>課税合計</td><td class="ps-val">${Utils.formatCurrency(p.taxableAmount)}</td></tr>
                  <tr><td>源泉区分</td><td class="ps-val">${taxCatLabel}</td></tr>
                  <tr><td>控除額（所得税）</td><td class="ps-val" style="color:var(--danger);">${Utils.formatCurrency(p.incomeTax)}</td></tr>
                </tbody>
                <thead>
                  <tr><th colspan="2" class="ps-section-header">差引支給</th></tr>
                </thead>
                <tbody>
                  <tr class="ps-net-row"><td><strong>支給額（手取り）</strong></td><td class="ps-val ps-net"><strong>${Utils.formatCurrency(p.netPay)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- フッター -->
          <div class="ps-footer">
            支給日：${payDateStr}
          </div>
        </div>

        <div class="btn-group mt-8 no-print" style="justify-content:center;">
          <button class="btn btn-sm btn-primary payslip-pdf-btn" data-staff="${p.staffId}">PDF出力</button>
          <button class="btn btn-sm btn-secondary payslip-print-btn" data-staff="${p.staffId}">印刷</button>
        </div>

        ${index % 2 === 0 && index < 99 ? '<div class="ps-page-break"></div>' : ''}
      </div>
    `;
  }

  // html2canvasで画面上の給与明細DOM要素を直接キャプチャ
  async function payslipToCanvas(staffId) {
    const el = document.getElementById('payslip-' + staffId);
    if (!el) return null;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scrollX: -scrollX,
      scrollY: -scrollY,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById('payslip-' + staffId);
        if (clonedEl) {
          clonedEl.style.display = 'block';
          clonedEl.style.visibility = 'visible';
        }
      }
    });

    return canvas;
  }

  // 1名分のPDF出力
  async function generateSinglePayslipPDF(p, period, periodJP, payDateStr) {
    Utils.showToast('PDF生成中...', '');
    const canvas = await payslipToCanvas(p.staffId);
    if (!canvas) { Utils.showToast('明細が見つかりません', 'error'); return; }

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const imgW = pageW;
    const imgH = canvas.height * imgW / canvas.width;

    doc.addImage(imgData, 'PNG', 0, 10, imgW, imgH);
    doc.save(`payslip_${p.staffName}_${period.start}_${period.end}.pdf`);
    Utils.showToast('PDFを出力しました', 'success');
  }

  // 全員分PDF（A4に2名ずつ）
  async function generateAllPayslipsPDF(payrolls, period, periodJP, payDateStr) {
    if (payrolls.length === 0) {
      Utils.showToast('出力するデータがありません', 'error');
      return;
    }

    Utils.showToast('PDF生成中...', '');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const pageH = 297;
    const halfH = pageH / 2;

    for (let i = 0; i < payrolls.length; i++) {
      const p = payrolls[i];
      const isTop = i % 2 === 0;

      if (i > 0 && isTop) doc.addPage();

      const canvas = await payslipToCanvas(p.staffId);
      if (!canvas) continue;

      const imgData = canvas.toDataURL('image/png');
      const imgW = pageW - 10;
      const imgH = canvas.height * imgW / canvas.width;

      const yPos = isTop ? 5 : halfH + 3;
      doc.addImage(imgData, 'PNG', 5, yPos, imgW, Math.min(imgH, halfH - 10));

      if (isTop) {
        doc.setDrawColor(150);
        doc.setLineDashPattern([3, 3], 0);
        doc.line(10, halfH, 200, halfH);
        doc.setLineDashPattern([], 0);
        doc.setDrawColor(0);
      }
    }

    doc.save(`payslip_all_${period.start}_${period.end}.pdf`);
    Utils.showToast('全員分のPDFを出力しました', 'success');
  }

  return { render };
})();
