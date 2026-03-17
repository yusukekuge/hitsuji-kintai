// ===== 画面6：シフト作成 =====
const ShiftEditScreen = (() => {
  let currentYear, currentMonth;

  function init() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth() + 1;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  }

  async function render() {
    if (currentYear === undefined) init();
    const container = document.getElementById('screen-shift-edit');
    const staff = await Storage.getStaff();
    const shifts = await Storage.getShifts(currentYear, currentMonth);
    const requests = await Storage.getShiftRequests(currentYear, currentMonth);
    const daysInMonth = Utils.getDaysInMonth(currentYear, currentMonth);

    // マップ化
    const shiftMap = {};
    shifts.forEach(s => { shiftMap[`${s.staffId}_${s.date}`] = s; });
    const reqMap = {};
    requests.forEach(r => { reqMap[`${r.staffId}_${r.date}`] = r; });

    const prefLabels = { available: '可', unavailable: '不可', preferred: '希望' };
    const prefColors = { available: '#27ae60', unavailable: '#e74c3c', preferred: '#3498db' };

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">シフト作成</h3>
        <div class="month-nav">
          <button class="btn btn-sm btn-secondary" id="se-prev">&lt; 前月</button>
          <span class="month-label">${currentYear}年${currentMonth+1}月</span>
          <button class="btn btn-sm btn-secondary" id="se-next">翌月 &gt;</button>
        </div>

        <div class="table-wrap">
          <table id="shift-edit-table">
            <thead>
              <tr>
                <th style="min-width:80px;">日付</th>
                ${staff.map(s => `<th style="min-width:160px;">${Utils.escapeHtml(s.name)}</th>`).join('')}
                <th>人数</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({length: daysInMonth}, (_, i) => {
                const d = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dow = Utils.getDayOfWeek(currentYear, currentMonth, d);
                const isSun = dow === 0;
                const isSat = dow === 6;
                const dateStyle = isSun ? 'color:var(--danger);' : isSat ? 'color:var(--info);' : '';

                return `
                  <tr>
                    <td style="${dateStyle}"><strong>${d}</strong>(${Utils.DAY_NAMES[dow]})</td>
                    ${staff.map(s => {
                      const key = `${s.id}_${dateStr}`;
                      const shift = shiftMap[key];
                      const req = reqMap[key];
                      const startVal = shift ? shift.startTime : '';
                      const endVal = shift ? shift.endTime : '';
                      const reqInfo = req ? `<span style="font-size:0.65rem;color:${prefColors[req.preference] || '#999'};">${prefLabels[req.preference] || ''}${req.startTime ? ' '+req.startTime+'~'+req.endTime : ''}</span>` : '';
                      return `
                        <td>
                          ${reqInfo}
                          <div class="form-inline" style="gap:2px;">
                            <input type="time" class="form-input se-start" data-staff="${s.id}" data-date="${dateStr}" value="${startVal}" style="width:80px;padding:3px;font-size:0.75rem;">
                            <span style="font-size:0.7rem;">〜</span>
                            <input type="time" class="form-input se-end" data-staff="${s.id}" data-date="${dateStr}" value="${endVal}" style="width:80px;padding:3px;font-size:0.75rem;">
                          </div>
                        </td>
                      `;
                    }).join('')}
                    <td class="num se-count" data-day="${d}">0</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="mt-16 btn-group" style="justify-content:center;">
          <button class="btn btn-primary btn-lg" id="se-save">シフトを確定・保存</button>
        </div>
      </div>
    `;

    // 人数カウント更新
    function updateCounts() {
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let count = 0;
        staff.forEach(s => {
          const start = container.querySelector(`.se-start[data-staff="${s.id}"][data-date="${dateStr}"]`);
          const end = container.querySelector(`.se-end[data-staff="${s.id}"][data-date="${dateStr}"]`);
          if (start && end && start.value && end.value) count++;
        });
        const cell = container.querySelector(`.se-count[data-day="${d}"]`);
        if (cell) cell.textContent = count || '-';
      }
    }

    updateCounts();

    // 時間入力変更時にカウント更新
    container.querySelectorAll('.se-start, .se-end').forEach(input => {
      input.addEventListener('change', updateCounts);
    });

    // 月ナビ
    document.getElementById('se-prev').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      render();
    });
    document.getElementById('se-next').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      render();
    });

    // 保存
    document.getElementById('se-save').addEventListener('click', handleSave);
  }

  async function handleSave() {
    const staff = await Storage.getStaff();
    const daysInMonth = Utils.getDaysInMonth(currentYear, currentMonth);
    const container = document.getElementById('screen-shift-edit');
    const shifts = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      staff.forEach(s => {
        const startEl = container.querySelector(`.se-start[data-staff="${s.id}"][data-date="${dateStr}"]`);
        const endEl = container.querySelector(`.se-end[data-staff="${s.id}"][data-date="${dateStr}"]`);
        if (startEl && endEl && startEl.value && endEl.value) {
          shifts.push({
            staffId: s.id,
            date: dateStr,
            startTime: startEl.value,
            endTime: endEl.value
          });
        }
      });
    }

    await Storage.saveShiftsBulk(shifts);
    Utils.showToast('シフトを保存しました', 'success');
  }

  return { render };
})();
