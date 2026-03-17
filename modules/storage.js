// ===== データ保存モジュール（モックモード＋GAS連携） =====
const Storage = (() => {
  let gasUrl = localStorage.getItem('gas_url') || '';
  let useGas = false;

  function init() {
    gasUrl = localStorage.getItem('gas_url') || '';
    useGas = gasUrl.length > 0;
  }

  function setGasUrl(url) {
    gasUrl = url;
    localStorage.setItem('gas_url', url);
    useGas = url.length > 0;
  }

  function getGasUrl() { return gasUrl; }
  function isGasMode() { return useGas; }

  // --- GAS通信 ---
  async function gasRequest(action, data = {}) {
    if (!useGas) throw new Error('GAS未設定');
    const payload = { action, ...data };
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json.data;
    } catch (e) {
      console.warn('GAS通信エラー、ローカルにフォールバック:', e.message);
      useGas = false;
      return null;
    }
  }

  // --- ローカルストレージ操作 ---
  function localGet(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch { return []; }
  }
  function localSet(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }
  function localGetObj(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch { return {}; }
  }

  // ===== スタッフ =====
  async function getStaff() {
    if (useGas) {
      const data = await gasRequest('getStaff');
      if (data) return data;
    }
    return localGet('staff').filter(s => s.active !== false);
  }

  async function getAllStaff() {
    if (useGas) {
      const data = await gasRequest('getAllStaff');
      if (data) return data;
    }
    return localGet('staff');
  }

  async function saveStaff(staff) {
    if (useGas) {
      await gasRequest('saveStaff', { staff });
    }
    const all = localGet('staff');
    const idx = all.findIndex(s => s.id === staff.id);
    if (idx >= 0) all[idx] = staff;
    else all.push(staff);
    localSet('staff', all);
  }

  async function deleteStaff(staffId) {
    if (useGas) {
      await gasRequest('deleteStaff', { staffId });
    }
    const all = localGet('staff');
    const idx = all.findIndex(s => s.id === staffId);
    if (idx >= 0) {
      all[idx].active = false;
      localSet('staff', all);
    }
  }

  // ===== 打刻記録 =====
  async function getTimeRecords(date) {
    if (useGas) {
      const data = await gasRequest('getTimeRecords', { date });
      if (data) return data;
    }
    return localGet('time_records').filter(r => r.date === date);
  }

  async function getTimeRecordsByMonth(year, month) {
    if (useGas) {
      const data = await gasRequest('getTimeRecordsByMonth', { year, month });
      if (data) return data;
    }
    const prefix = `${year}-${String(month+1).padStart(2,'0')}`;
    return localGet('time_records').filter(r => r.date.startsWith(prefix));
  }

  async function getTimeRecordsByRange(startDate, endDate) {
    if (useGas) {
      const data = await gasRequest('getTimeRecordsByRange', { startDate, endDate });
      if (data) return data;
    }
    return localGet('time_records').filter(r => r.date >= startDate && r.date <= endDate);
  }

  async function addTimeRecord(record) {
    if (useGas) {
      await gasRequest('addTimeRecord', { record });
    }
    const all = localGet('time_records');
    all.push(record);
    localSet('time_records', all);
  }

  async function updateTimeRecord(record) {
    if (useGas) {
      await gasRequest('updateTimeRecord', { record });
    }
    const all = localGet('time_records');
    const idx = all.findIndex(r => r.id === record.id);
    if (idx >= 0) {
      all[idx] = record;
      localSet('time_records', all);
    }
  }

  async function deleteTimeRecord(recordId) {
    if (useGas) {
      await gasRequest('deleteTimeRecord', { recordId });
    }
    let all = localGet('time_records');
    all = all.filter(r => r.id !== recordId);
    localSet('time_records', all);
  }

  // ===== シフト（確定） =====
  async function getShifts(year, month) {
    if (useGas) {
      const data = await gasRequest('getShifts', { year, month });
      if (data) return data;
    }
    const prefix = `${year}-${String(month+1).padStart(2,'0')}`;
    return localGet('shifts').filter(s => s.date.startsWith(prefix));
  }

  async function saveShift(shift) {
    if (useGas) {
      await gasRequest('saveShift', { shift });
    }
    const all = localGet('shifts');
    const idx = all.findIndex(s => s.staffId === shift.staffId && s.date === shift.date);
    if (idx >= 0) all[idx] = shift;
    else all.push(shift);
    localSet('shifts', all);
  }

  async function deleteShift(staffId, date) {
    if (useGas) {
      await gasRequest('deleteShift', { staffId, date });
    }
    let all = localGet('shifts');
    all = all.filter(s => !(s.staffId === staffId && s.date === date));
    localSet('shifts', all);
  }

  async function saveShiftsBulk(shifts) {
    if (useGas) {
      await gasRequest('saveShiftsBulk', { shifts });
    }
    // ローカル: 月のデータを丸ごと置き換え
    if (shifts.length === 0) return;
    const firstDate = shifts[0].date;
    const prefix = firstDate.substring(0, 7);
    let all = localGet('shifts').filter(s => !s.date.startsWith(prefix));
    all = all.concat(shifts);
    localSet('shifts', all);
  }

  // ===== 希望シフト =====
  async function getShiftRequests(year, month) {
    if (useGas) {
      const data = await gasRequest('getShiftRequests', { year, month });
      if (data) return data;
    }
    const prefix = `${year}-${String(month+1).padStart(2,'0')}`;
    return localGet('shift_requests').filter(s => s.date.startsWith(prefix));
  }

  async function saveShiftRequest(request) {
    if (useGas) {
      await gasRequest('saveShiftRequest', { request });
    }
    const all = localGet('shift_requests');
    const idx = all.findIndex(r => r.staffId === request.staffId && r.date === request.date);
    if (idx >= 0) all[idx] = request;
    else all.push(request);
    localSet('shift_requests', all);
  }

  async function saveShiftRequestsBulk(requests) {
    if (useGas) {
      await gasRequest('saveShiftRequestsBulk', { requests });
    }
    if (requests.length === 0) return;
    const staffId = requests[0].staffId;
    const prefix = requests[0].date.substring(0, 7);
    let all = localGet('shift_requests').filter(
      r => !(r.staffId === staffId && r.date.startsWith(prefix))
    );
    all = all.concat(requests);
    localSet('shift_requests', all);
  }

  // ===== 設定 =====
  function getSetting(key, defaultVal = '') {
    const settings = localGetObj('app_settings');
    return settings[key] !== undefined ? settings[key] : defaultVal;
  }

  function setSetting(key, value) {
    const settings = localGetObj('app_settings');
    settings[key] = value;
    localSet('app_settings', settings);
  }

  // PIN
  function getPin() { return getSetting('admin_pin', ''); }
  function setPin(pin) { setSetting('admin_pin', pin); }
  function verifyPin(pin) {
    const stored = getPin();
    if (!stored) return true; // PIN未設定時は認証不要
    return pin === stored;
  }

  init();

  return {
    init, setGasUrl, getGasUrl, isGasMode,
    getStaff, getAllStaff, saveStaff, deleteStaff,
    getTimeRecords, getTimeRecordsByMonth, getTimeRecordsByRange,
    addTimeRecord, updateTimeRecord, deleteTimeRecord,
    getShifts, saveShift, deleteShift, saveShiftsBulk,
    getShiftRequests, saveShiftRequest, saveShiftRequestsBulk,
    getSetting, setSetting, getPin, setPin, verifyPin
  };
})();
