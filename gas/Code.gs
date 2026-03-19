// ===== Google Apps Script - 勤怠管理システム バックエンド =====
//
// 【セットアップ手順】
// 1. Google スプレッドシートを新規作成
// 2. スプレッドシートのURLから SS_ID をコピー
//    例: https://docs.google.com/spreadsheets/d/★ここがSS_ID★/edit
// 3. 下の SS_ID に貼り付け
// 4. GASエディタでこのコードを貼り付け
// 5. initializeSpreadsheet() を手動実行してシートを初期化
// 6.「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
//    - 実行するユーザー：自分
//    - アクセスできるユーザー：全員
// 7. 生成されたURLをアプリの設定画面に入力

// ★★★ ここにスプレッドシートIDを設定 ★★★
const SS_ID = 'YOUR_SPREADSHEET_ID_HERE';

// ===== スプレッドシート初期化 =====
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.openById(SS_ID);

  // time_records シート
  let sheet = ss.getSheetByName('time_records');
  if (!sheet) {
    sheet = ss.insertSheet('time_records');
    sheet.appendRow(['id', 'staffId', 'date', 'type', 'time', 'modified', 'createdAt']);
    sheet.getRange('1:1').setFontWeight('bold');
  }

  // staff シート
  sheet = ss.getSheetByName('staff');
  if (!sheet) {
    sheet = ss.insertSheet('staff');
    sheet.appendRow(['id', 'name', 'hourlyRate', 'probation', 'commuteDistance', 'hireDate', 'otherAllowance', 'taxCategory', 'dependents', 'active']);
    sheet.getRange('1:1').setFontWeight('bold');
  }

  // shifts シート
  sheet = ss.getSheetByName('shifts');
  if (!sheet) {
    sheet = ss.insertSheet('shifts');
    sheet.appendRow(['staffId', 'date', 'startTime', 'endTime']);
    sheet.getRange('1:1').setFontWeight('bold');
  }

  // shift_requests シート
  sheet = ss.getSheetByName('shift_requests');
  if (!sheet) {
    sheet = ss.insertSheet('shift_requests');
    sheet.appendRow(['staffId', 'date', 'preference', 'startTime', 'endTime']);
    sheet.getRange('1:1').setFontWeight('bold');
  }

  // settings シート
  sheet = ss.getSheetByName('settings');
  if (!sheet) {
    sheet = ss.insertSheet('settings');
    sheet.appendRow(['key', 'value']);
    sheet.getRange('1:1').setFontWeight('bold');
    // デフォルト設定値を投入
    sheet.appendRow(['closing_day', '20']);
    sheet.appendRow(['pay_day', '25']);
  }

  Logger.log('全シートの初期化が完了しました');
}

// ===== Web API エントリポイント =====

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    let result;

    switch (action) {
      // --- 疎通確認 ---
      case 'ping':
        return jsonOk({ message: 'pong' });

      // --- スタッフ ---
      case 'getStaff':
        result = getStaff();
        break;
      case 'getAllStaff':
        result = getAllStaff();
        break;
      case 'saveStaff':
        result = saveStaff(payload.staff);
        break;
      case 'deleteStaff':
        result = deleteStaff(payload.staffId);
        break;

      // --- 打刻記録 ---
      case 'getTimeRecords':
        result = getTimeRecords(payload.date);
        break;
      case 'getTimeRecordsByMonth':
        result = getTimeRecordsByMonth(payload.year, payload.month);
        break;
      case 'getTimeRecordsByRange':
        result = getTimeRecordsByRange(payload.startDate, payload.endDate);
        break;
      case 'saveTimeRecord':
      case 'addTimeRecord':
        result = addTimeRecord(payload.record);
        break;
      case 'updateTimeRecord':
        result = updateTimeRecord(payload.record);
        break;
      case 'deleteTimeRecord':
        result = deleteTimeRecord(payload.recordId);
        break;

      // --- シフト ---
      case 'getShifts':
        result = getShifts(payload.year, payload.month);
        break;
      case 'saveShift':
        result = saveShift(payload.shift);
        break;
      case 'deleteShift':
        result = deleteShift(payload.staffId, payload.date);
        break;
      case 'saveShiftsBulk':
        result = saveShiftsBulk(payload.shifts);
        break;

      // --- 希望シフト ---
      case 'getShiftRequests':
        result = getShiftRequests(payload.year, payload.month);
        break;
      case 'saveShiftRequest':
        result = saveShiftRequest(payload.request);
        break;
      case 'saveShiftRequestsBulk':
        result = saveShiftRequestsBulk(payload.requests);
        break;

      // --- 設定 ---
      case 'getSettings':
        result = getSettings();
        break;
      case 'saveSettings':
        result = saveSettings(payload.key, payload.value);
        break;

      default:
        return jsonError('Unknown action: ' + action);
    }

    return jsonOk(result);
  } catch (err) {
    return jsonError(err.message);
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') {
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, data: { message: 'pong' } })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(
    JSON.stringify({
      success: true,
      data: { message: '勤怠管理システム API is running', version: '2.0' }
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ===== レスポンスヘルパー（CORS対応） =====

function jsonOk(data) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, data: data })
  ).setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: false, error: message })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ===== シートヘルパー =====

function getSheet(name) {
  return SpreadsheetApp.openById(SS_ID).getSheetByName(name);
}

function sheetToArray(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

function findRowIndex(sheet, col, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col]) === String(value)) return i + 1; // 1-indexed (シート行番号)
  }
  return -1;
}

function findRowIndex2(sheet, col1, val1, col2, val2) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col1]) === String(val1) && String(data[i][col2]) === String(val2)) {
      return i + 1;
    }
  }
  return -1;
}

// ===== スタッフ CRUD =====

function getStaff() {
  const sheet = getSheet('staff');
  return sheetToArray(sheet).filter(s => s.active !== false && s.active !== 'false' && s.active !== 0 && s.active !== '0');
}

function getAllStaff() {
  return sheetToArray(getSheet('staff'));
}

function saveStaff(staff) {
  const sheet = getSheet('staff');
  const rowIdx = findRowIndex(sheet, 0, staff.id);
  const row = [
    staff.id,
    staff.name,
    staff.hourlyRate || staff.hourlyWage || 1150,
    staff.probation ? 1 : 0,
    staff.commuteDistance || 0,
    staff.hireDate || '',
    staff.otherAllowance || 0,
    staff.taxCategory || 'kou',
    staff.dependents || 0,
    staff.active !== false ? 1 : 0
  ];
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return 'ok';
}

function deleteStaff(staffId) {
  const sheet = getSheet('staff');
  const rowIdx = findRowIndex(sheet, 0, staffId);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 10).setValue(0); // active = 0 (列J)
  }
  return 'ok';
}

// ===== 打刻記録 CRUD =====

function getTimeRecords(date) {
  return sheetToArray(getSheet('time_records')).filter(r => String(r.date) === String(date));
}

function getTimeRecordsByMonth(year, month) {
  const prefix = String(year) + '-' + String(month + 1).padStart(2, '0');
  return sheetToArray(getSheet('time_records')).filter(r => String(r.date).startsWith(prefix));
}

function getTimeRecordsByRange(startDate, endDate) {
  return sheetToArray(getSheet('time_records')).filter(r => {
    const d = String(r.date);
    return d >= String(startDate) && d <= String(endDate);
  });
}

function addTimeRecord(record) {
  const sheet = getSheet('time_records');
  sheet.appendRow([
    record.id,
    record.staffId,
    record.date,
    record.type,
    record.time,
    record.modified ? 1 : 0,
    new Date().toISOString()
  ]);
  return 'ok';
}

function updateTimeRecord(record) {
  const sheet = getSheet('time_records');
  const rowIdx = findRowIndex(sheet, 0, record.id);
  if (rowIdx > 0) {
    const row = [
      record.id,
      record.staffId,
      record.date,
      record.type,
      record.time,
      record.modified ? 1 : 0,
      new Date().toISOString()
    ];
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    return 'ok';
  }
  return 'not_found';
}

function deleteTimeRecord(recordId) {
  const sheet = getSheet('time_records');
  const rowIdx = findRowIndex(sheet, 0, recordId);
  if (rowIdx > 0) {
    sheet.deleteRow(rowIdx);
    return 'ok';
  }
  return 'not_found';
}

// ===== シフト CRUD =====

function getShifts(year, month) {
  const prefix = String(year) + '-' + String(month + 1).padStart(2, '0');
  return sheetToArray(getSheet('shifts')).filter(s => String(s.date).startsWith(prefix));
}

function saveShift(shift) {
  const sheet = getSheet('shifts');
  const rowIdx = findRowIndex2(sheet, 0, shift.staffId, 1, shift.date);
  const row = [shift.staffId, shift.date, shift.startTime, shift.endTime];
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, 4).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return 'ok';
}

function deleteShift(staffId, date) {
  const sheet = getSheet('shifts');
  const rowIdx = findRowIndex2(sheet, 0, staffId, 1, date);
  if (rowIdx > 0) {
    sheet.deleteRow(rowIdx);
  }
  return 'ok';
}

function saveShiftsBulk(shifts) {
  if (!shifts || shifts.length === 0) return 'ok';
  const sheet = getSheet('shifts');
  const prefix = String(shifts[0].date).substring(0, 7);

  // 該当月のデータを全削除（逆順で削除）
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]).startsWith(prefix)) {
      sheet.deleteRow(i + 1);
    }
  }

  // 新しいデータを一括追加
  const rows = shifts.map(s => [s.staffId, s.date, s.startTime, s.endTime]);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  }
  return 'ok';
}

// ===== 希望シフト CRUD =====

function getShiftRequests(year, month) {
  const prefix = String(year) + '-' + String(month + 1).padStart(2, '0');
  return sheetToArray(getSheet('shift_requests')).filter(r => String(r.date).startsWith(prefix));
}

function saveShiftRequest(request) {
  const sheet = getSheet('shift_requests');
  const rowIdx = findRowIndex2(sheet, 0, request.staffId, 1, request.date);
  const row = [request.staffId, request.date, request.preference, request.startTime || '', request.endTime || ''];
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, 5).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return 'ok';
}

function saveShiftRequestsBulk(requests) {
  if (!requests || requests.length === 0) return 'ok';
  const sheet = getSheet('shift_requests');
  const staffId = String(requests[0].staffId);
  const prefix = String(requests[0].date).substring(0, 7);

  // 該当スタッフ・月のデータを全削除（逆順）
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === staffId && String(data[i][1]).startsWith(prefix)) {
      sheet.deleteRow(i + 1);
    }
  }

  // 新しいデータを一括追加
  const rows = requests.map(r => [r.staffId, r.date, r.preference, r.startTime || '', r.endTime || '']);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }
  return 'ok';
}

// ===== 設定 CRUD =====

function getSettings() {
  const sheet = getSheet('settings');
  const data = sheetToArray(sheet);
  const settings = {};
  data.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
}

function saveSettings(key, value) {
  const sheet = getSheet('settings');
  const rowIdx = findRowIndex(sheet, 0, key);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(value);
  } else {
    sheet.appendRow([key, value]);
  }
  return 'ok';
}
