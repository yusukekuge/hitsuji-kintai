// ===== 画面2：シフト表（閲覧用） =====
const ShiftViewScreen = (() => {
  let currentYear, currentMonth;

  function init() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
  }

  async function render() {
    if (currentYear === undefined) init();
    const container = document.getElementById('screen-shift-view');
    const staff = await Storage.getStaff();
    const shifts = await Storage.getShifts(currentYear, currentMonth);
    const daysInMonth = Utils.getDaysInMonth(currentYear, currentMonth);
    const todayStr = Utils.today();

    // シフトマップ作成
    const shiftMap = {};
    shifts.forEach(s => {
      const key = `${s.staffId}_${s.date}`;
      shiftMap[key] = s;
    });

    // 日別集計
    const daySummary = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let count = 0;
      let totalMin = 0;
      staff.forEach(s => {
        const shift = shiftMap[`${s.id}_${dateStr}`];
        if (shift && shift.startTime && shift.endTime) {
          count++;
          const [sh, sm] = shift.startTime.split(':').map(Number);
          const [eh, em] = shift.endTime.split(':').map(Number);
          totalMin += (eh * 60 + em) - (sh * 60 + sm);
        }
      });
      daySummary[d] = { count, totalMin };
    }

    container.innerHTML = `
      <div class="card">
        <div class="flex-between mb-16">
          <h3 class="card-title" style="margin-bottom:0;border:none;">シフト表</h3>
          <button class="btn btn-sm btn-secondary no-print" onclick="window.print()">印刷</button>
        </div>
        <div class="month-nav">
          <button class="btn btn-sm btn-secondary" id="sv-prev">&lt; 前月</button>
          <span class="month-label">${currentYear}年${currentMonth+1}月</span>
          <button class="btn btn-sm btn-secondary" id="sv-next">翌月 &gt;</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="min-width:70px;">日付</th>
                ${staff.map(s => `<th style="min-width:80px;">${Utils.escapeHtml(s.name)}</th>`).join('')}
                <th>人数</th>
                <th>合計時間</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({length: daysInMonth}, (_, i) => {
                const d = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dow = Utils.getDayOfWeek(currentYear, currentMonth, d);
                const isToday = dateStr === todayStr;
                const isSun = dow === 0;
                const isSat = dow === 6;
                const rowClass = isToday ? 'style="background:var(--primary-light);"' : '';
                const dateClass = isSun ? 'style="color:var(--danger);"' : isSat ? 'style="color:var(--info);"' : '';
                return `
                  <tr ${rowClass}>
                    <td ${dateClass}><strong>${d}</strong> (${Utils.DAY_NAMES[dow]})</td>
                    ${staff.map(s => {
                      const shift = shiftMap[`${s.id}_${dateStr}`];
                      if (shift && shift.startTime && shift.endTime) {
                        return `<td style="font-size:0.8rem;">${shift.startTime}〜${shift.endTime}</td>`;
                      }
                      return '<td>-</td>';
                    }).join('')}
                    <td class="num">${daySummary[d].count || '-'}</td>
                    <td class="num">${daySummary[d].totalMin > 0 ? Utils.minutesToHM(daySummary[d].totalMin) : '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('sv-prev').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      render();
    });
    document.getElementById('sv-next').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      render();
    });
  }

  return { render };
})();
