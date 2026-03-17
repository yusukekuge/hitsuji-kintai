// ===== 画面3：希望シフト入力 =====
const ShiftRequestScreen = (() => {
  let currentYear, currentMonth, selectedStaffId = null;

  function init() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth() + 1; // 来月のシフト希望
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  }

  async function render() {
    if (currentYear === undefined) init();
    const container = document.getElementById('screen-shift-request');
    const staff = await Storage.getStaff();
    const requests = selectedStaffId
      ? await Storage.getShiftRequests(currentYear, currentMonth)
      : [];

    const daysInMonth = Utils.getDaysInMonth(currentYear, currentMonth);

    // 既存の希望をマップ化
    const reqMap = {};
    requests.filter(r => r.staffId === selectedStaffId).forEach(r => {
      reqMap[r.date] = r;
    });

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">希望シフト入力</h3>
        <div class="form-group">
          <label class="form-label">スタッフ選択</label>
          <div class="staff-grid">
            ${staff.map(s => `
              <button class="staff-btn ${selectedStaffId === s.id ? 'selected' : ''}" data-id="${s.id}">
                ${Utils.escapeHtml(s.name)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      ${selectedStaffId ? `
      <div class="card">
        <div class="month-nav">
          <button class="btn btn-sm btn-secondary" id="sr-prev">&lt; 前月</button>
          <span class="month-label">${currentYear}年${currentMonth+1}月</span>
          <button class="btn btn-sm btn-secondary" id="sr-next">翌月 &gt;</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th>希望</th>
                <th>開始</th>
                <th>終了</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({length: daysInMonth}, (_, i) => {
                const d = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dow = Utils.getDayOfWeek(currentYear, currentMonth, d);
                const req = reqMap[dateStr];
                const pref = req ? req.preference : '';
                const startT = req ? (req.startTime || '') : '';
                const endT = req ? (req.endTime || '') : '';
                const isSun = dow === 0;
                const isSat = dow === 6;
                const dateStyle = isSun ? 'color:var(--danger);' : isSat ? 'color:var(--info);' : '';
                return `
                  <tr data-date="${dateStr}">
                    <td style="${dateStyle}"><strong>${d}</strong>(${Utils.DAY_NAMES[dow]})</td>
                    <td>
                      <select class="form-select sr-pref" data-date="${dateStr}" style="width:100px;">
                        <option value="">未入力</option>
                        <option value="available" ${pref==='available'?'selected':''}>出勤可</option>
                        <option value="unavailable" ${pref==='unavailable'?'selected':''}>出勤不可</option>
                        <option value="preferred" ${pref==='preferred'?'selected':''}>希望</option>
                      </select>
                    </td>
                    <td><input type="time" class="form-input sr-start" data-date="${dateStr}" value="${startT}" style="width:110px;"></td>
                    <td><input type="time" class="form-input sr-end" data-date="${dateStr}" value="${endT}" style="width:110px;"></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="mt-16 text-center">
          <button class="btn btn-primary btn-lg" id="sr-save">希望シフトを送信</button>
        </div>
      </div>
      ` : ''}
    `;

    // スタッフ選択
    container.querySelectorAll('.staff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedStaffId = btn.dataset.id;
        render();
      });
    });

    // 月ナビ
    if (selectedStaffId) {
      document.getElementById('sr-prev')?.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        render();
      });
      document.getElementById('sr-next')?.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        render();
      });

      // 保存
      document.getElementById('sr-save')?.addEventListener('click', handleSave);
    }
  }

  async function handleSave() {
    if (!selectedStaffId) return;
    const rows = document.querySelectorAll('#screen-shift-request table tbody tr');
    const requests = [];

    rows.forEach(row => {
      const date = row.dataset.date;
      const pref = row.querySelector('.sr-pref').value;
      const startTime = row.querySelector('.sr-start').value;
      const endTime = row.querySelector('.sr-end').value;

      if (pref) {
        requests.push({
          staffId: selectedStaffId,
          date,
          preference: pref,
          startTime: startTime || '',
          endTime: endTime || ''
        });
      }
    });

    await Storage.saveShiftRequestsBulk(requests);
    Utils.showToast('希望シフトを保存しました', 'success');
  }

  return { render };
})();
