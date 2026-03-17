// ===== 画面10：設定 =====
const SettingsScreen = (() => {
  async function render() {
    const container = document.getElementById('screen-settings');
    const currentPin = Storage.getPin();
    const gasUrl = Storage.getGasUrl();
    const closingDay = Storage.getSetting('closing_day', '20');
    const payDay = Storage.getSetting('pay_day', '25');

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title">設定</h3>
      </div>

      <!-- PINコード設定 -->
      <div class="card">
        <h3 class="card-title">管理者PINコード</h3>
        <p style="color:var(--text-light);font-size:0.85rem;margin-bottom:12px;">
          管理者画面へのアクセスを制限するPINコード（4桁）を設定します。
          ${currentPin ? '<span class="badge badge-success">設定済み</span>' : '<span class="badge badge-warning">未設定</span>'}
        </p>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">新しいPINコード</label>
            <input type="password" class="form-input" id="set-pin" maxlength="4" pattern="[0-9]{4}" inputmode="numeric" placeholder="4桁の数字">
          </div>
          <div class="form-group">
            <label class="form-label">PINコード（確認）</label>
            <input type="password" class="form-input" id="set-pin-confirm" maxlength="4" pattern="[0-9]{4}" inputmode="numeric" placeholder="もう一度入力">
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="set-pin-save">PINコードを設定</button>
          ${currentPin ? '<button class="btn btn-danger" id="set-pin-clear">PINコードを解除</button>' : ''}
        </div>
      </div>

      <!-- GAS設定 -->
      <div class="card">
        <h3 class="card-title">Google Apps Script (GAS) 連携</h3>
        <p style="color:var(--text-light);font-size:0.85rem;margin-bottom:12px;">
          GAS WebアプリのURLを設定すると、データがGoogleスプレッドシートに保存されます。
          未設定時はブラウザのlocalStorageにデータが保存されます（モックモード）。
          ${Storage.isGasMode() ? '<span class="badge badge-success">GAS接続中</span>' : '<span class="badge badge-warning">モックモード</span>'}
        </p>
        <div class="form-group">
          <label class="form-label">GAS WebアプリURL</label>
          <input type="url" class="form-input" id="set-gas-url" value="${Utils.escapeHtml(gasUrl)}" placeholder="https://script.google.com/macros/s/xxx/exec">
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="set-gas-save">URLを保存</button>
          ${gasUrl ? '<button class="btn btn-secondary" id="set-gas-test">接続テスト</button>' : ''}
          ${gasUrl ? '<button class="btn btn-danger" id="set-gas-clear">GAS連携を解除</button>' : ''}
        </div>
      </div>

      <!-- 締め日・支払日 -->
      <div class="card">
        <h3 class="card-title">締め日・支払日設定</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">締め日</label>
            <select class="form-select" id="set-closing-day">
              ${Array.from({length:28}, (_, i) => `<option value="${i+1}" ${closingDay==String(i+1)?'selected':''}>${i+1}日</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">支払日</label>
            <select class="form-select" id="set-pay-day">
              ${Array.from({length:28}, (_, i) => `<option value="${i+1}" ${payDay==String(i+1)?'selected':''}>${i+1}日</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-primary" id="set-date-save">保存</button>
      </div>

      <!-- データ管理 -->
      <div class="card">
        <h3 class="card-title">データ管理</h3>
        <p style="color:var(--text-light);font-size:0.85rem;margin-bottom:12px;">
          ローカルデータのエクスポート・インポート、初期化を行います。
        </p>
        <div class="btn-group">
          <button class="btn btn-secondary" id="set-export">データエクスポート</button>
          <button class="btn btn-secondary" id="set-import">データインポート</button>
          <button class="btn btn-danger" id="set-reset">データ初期化</button>
        </div>
        <input type="file" id="set-import-file" accept=".json" style="display:none;">
      </div>
    `;

    // PINコード設定
    document.getElementById('set-pin-save').addEventListener('click', () => {
      const pin = document.getElementById('set-pin').value;
      const confirm = document.getElementById('set-pin-confirm').value;
      if (!/^\d{4}$/.test(pin)) {
        Utils.showToast('PINコードは4桁の数字で入力してください', 'error');
        return;
      }
      if (pin !== confirm) {
        Utils.showToast('PINコードが一致しません', 'error');
        return;
      }
      Storage.setPin(pin);
      Utils.showToast('PINコードを設定しました', 'success');
      render();
    });

    document.getElementById('set-pin-clear')?.addEventListener('click', async () => {
      const ok = await Utils.showConfirm('PIN解除', 'PINコードを解除しますか？管理者画面に誰でもアクセスできるようになります。');
      if (ok) {
        Storage.setPin('');
        Utils.showToast('PINコードを解除しました');
        render();
      }
    });

    // GAS設定
    document.getElementById('set-gas-save').addEventListener('click', () => {
      const url = document.getElementById('set-gas-url').value.trim();
      Storage.setGasUrl(url);
      Storage.init();
      Utils.showToast(url ? 'GAS URLを保存しました' : 'GAS URLをクリアしました', 'success');
      render();
    });

    document.getElementById('set-gas-test')?.addEventListener('click', async () => {
      try {
        const res = await fetch(Storage.getGasUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'ping' })
        });
        const json = await res.json();
        if (json.status === 'ok') {
          Utils.showToast('GAS接続成功！', 'success');
        } else {
          Utils.showToast('GAS応答エラー: ' + (json.error || '不明'), 'error');
        }
      } catch (e) {
        Utils.showToast('GAS接続失敗: ' + e.message, 'error');
      }
    });

    document.getElementById('set-gas-clear')?.addEventListener('click', () => {
      Storage.setGasUrl('');
      Storage.init();
      Utils.showToast('GAS連携を解除しました（モックモードに切り替え）');
      render();
    });

    // 締め日・支払日
    document.getElementById('set-date-save').addEventListener('click', () => {
      Storage.setSetting('closing_day', document.getElementById('set-closing-day').value);
      Storage.setSetting('pay_day', document.getElementById('set-pay-day').value);
      Utils.showToast('締め日・支払日を保存しました', 'success');
    });

    // エクスポート
    document.getElementById('set-export').addEventListener('click', () => {
      const data = {
        staff: JSON.parse(localStorage.getItem('staff') || '[]'),
        time_records: JSON.parse(localStorage.getItem('time_records') || '[]'),
        shifts: JSON.parse(localStorage.getItem('shifts') || '[]'),
        shift_requests: JSON.parse(localStorage.getItem('shift_requests') || '[]'),
        app_settings: JSON.parse(localStorage.getItem('app_settings') || '{}')
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kintai_backup_${Utils.today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Utils.showToast('データをエクスポートしました', 'success');
    });

    // インポート
    document.getElementById('set-import').addEventListener('click', () => {
      document.getElementById('set-import-file').click();
    });
    document.getElementById('set-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ok = await Utils.showConfirm('データインポート', '現在のデータが上書きされます。よろしいですか？');
      if (!ok) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        if (data.staff) localStorage.setItem('staff', JSON.stringify(data.staff));
        if (data.time_records) localStorage.setItem('time_records', JSON.stringify(data.time_records));
        if (data.shifts) localStorage.setItem('shifts', JSON.stringify(data.shifts));
        if (data.shift_requests) localStorage.setItem('shift_requests', JSON.stringify(data.shift_requests));
        if (data.app_settings) localStorage.setItem('app_settings', JSON.stringify(data.app_settings));
        Utils.showToast('データをインポートしました', 'success');
        render();
      } catch (err) {
        Utils.showToast('ファイル形式が正しくありません', 'error');
      }
    });

    // 初期化
    document.getElementById('set-reset').addEventListener('click', async () => {
      const ok = await Utils.showConfirm('データ初期化', '全てのデータが削除されます。この操作は取り消せません。本当によろしいですか？');
      if (ok) {
        localStorage.removeItem('staff');
        localStorage.removeItem('time_records');
        localStorage.removeItem('shifts');
        localStorage.removeItem('shift_requests');
        Utils.showToast('データを初期化しました');
        render();
      }
    });
  }

  return { render };
})();
