/**
 * StackVid Connect - Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  let activeDomain = 'tiktok.com';
  let activeSession = null;

  // DOM Elements
  const targetDomainEl = document.getElementById('target-domain');
  const statusDotEl = document.getElementById('status-dot');
  const statusTextEl = document.getElementById('status-text');
  const statusTipEl = document.getElementById('status-tip');
  const valOdinEl = document.getElementById('val-odin');
  const valCookiesEl = document.getElementById('val-cookies');
  const valMsTokenEl = document.getElementById('val-mstoken');
  const valTimeEl = document.getElementById('val-time');

  const btnCopyJson = document.getElementById('btn-copy-json');
  const btnCopyJsonText = document.getElementById('btn-copy-json-text');
  const btnCopyCookies = document.getElementById('btn-copy-cookies');
  const btnCopyCookiesText = document.getElementById('btn-copy-cookies-text');
  const btnReset = document.getElementById('btn-reset');

  const inputGateway = document.getElementById('input-gateway');
  const inputApiKey = document.getElementById('input-apikey');
  const btnSyncGateway = document.getElementById('btn-sync-gateway');
  const btnSyncText = document.getElementById('btn-sync-text');
  const syncStatusEl = document.getElementById('sync-status');
  const btnToggleConfig = document.getElementById('btn-toggle-config');
  const configRow = document.getElementById('config-row');
  const btnToggleKey = document.getElementById('btn-toggle-key');

  // Toggle Endpoint config input
  btnToggleConfig.addEventListener('click', () => {
    const isHidden = configRow.style.display === 'none';
    configRow.style.display = isHidden ? 'block' : 'none';
  });

  // Toggle API Key visibility
  btnToggleKey.addEventListener('click', () => {
    const isPass = inputApiKey.type === 'password';
    inputApiKey.type = isPass ? 'text' : 'password';
    btnToggleKey.textContent = isPass ? '🔒' : '👁';
  });

  // Load saved gateway settings
  chrome.storage.local.get(['savedGatewayUrl', 'savedApiKey'], (res) => {
    if (res.savedGatewayUrl) inputGateway.value = res.savedGatewayUrl;
    if (res.savedApiKey) inputApiKey.value = res.savedApiKey;
  });

  // 1. Identify active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) {
      const url = new URL(tabs[0].url);
      const host = url.hostname;
      if (host.includes('tiktok.com')) activeDomain = 'tiktok.com';
      else if (host.includes('facebook.com')) activeDomain = 'facebook.com';
      else {
        const parts = host.split('.');
        activeDomain = parts.length >= 2 ? parts.slice(-2).join('.') : host;
      }
    }
  } catch (err) {
    console.warn('Could not query active tab:', err);
  }

  targetDomainEl.textContent = activeDomain;

  // 2. Fetch session from background
  function refreshSession() {
    chrome.runtime.sendMessage({ type: 'GET_SESSION', domain: activeDomain }, (res) => {
      activeSession = res?.session || null;
      renderSession(activeSession);
    });
  }

  refreshSession();

  // 3. Render session state
  function renderSession(session) {
    const http = session?.http;

    if (http) {
      statusDotEl.className = 'dot dot-ready';
      statusTextEl.className = 'status-text ready';
      statusTextEl.textContent = 'READY';
      statusTipEl.textContent = 'Đã bắt được phiên làm việc hợp lệ. Sẵn sàng copy hoặc đẩy vào StackVid.';

      const odin = http.params?.odinId || '—';
      const cookieCount = Object.keys(http.cookies || {}).length;
      const msToken = http.params?.msToken || http.cookies?.msToken;
      const timeStr = http.timestamp ? formatTime(http.timestamp) : 'Vừa xong';

      valOdinEl.textContent = odin;
      valCookiesEl.textContent = `${cookieCount} mục`;
      valMsTokenEl.textContent = msToken ? '✓ Có' : 'Không';
      valTimeEl.textContent = timeStr;
    } else {
      statusDotEl.className = 'dot dot-waiting';
      statusTextEl.className = 'status-text waiting';
      statusTextEl.textContent = 'ĐANG CHỜ';
      statusTipEl.textContent = `Mở tab ${activeDomain} và thực hiện thao tác duyệt để bắt session.`;

      valOdinEl.textContent = '—';
      valCookiesEl.textContent = '0';
      valMsTokenEl.textContent = '—';
      valTimeEl.textContent = '—';
    }
  }

  function formatTime(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Vừa xong';
    }
  }

  // 4. Copy Actions
  btnCopyJson.addEventListener('click', async () => {
    if (!activeSession || !activeSession.http) {
      flashButton(btnCopyJson, btnCopyJsonText, 'CHƯA CÓ SESSION!', false);
      return;
    }

    try {
      const text = JSON.stringify(activeSession, null, 2);
      await navigator.clipboard.writeText(text);
      flashButton(btnCopyJson, btnCopyJsonText, '✓ COPIED JSON!', true);
    } catch (err) {
      flashButton(btnCopyJson, btnCopyJsonText, 'LỖI COPY!', false);
    }
  });

  btnCopyCookies.addEventListener('click', async () => {
    const raw = activeSession?.http?.headers?.Cookie || activeSession?.http?.headers?.cookie || '';
    if (!raw) {
      flashButton(btnCopyCookies, btnCopyCookiesText, 'CHƯA CÓ COOKIES!', false);
      return;
    }

    try {
      await navigator.clipboard.writeText(raw);
      flashButton(btnCopyCookies, btnCopyCookiesText, '✓ COPIED RAW COOKIES!', true);
    } catch (err) {
      flashButton(btnCopyCookies, btnCopyCookiesText, 'LỖI COPY!', false);
    }
  });

  function flashButton(btn, textEl, tempText, isSuccess) {
    const origText = textEl.textContent;
    btn.classList.add('copied');
    textEl.textContent = tempText;

    setTimeout(() => {
      btn.classList.remove('copied');
      textEl.textContent = origText;
    }, 1500);
  }

  // 5. Reset / Clear Cache
  btnReset.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_SESSION', domain: activeDomain }, () => {
      activeSession = null;
      renderSession(null);
      syncStatusEl.textContent = 'Đã xóa bộ nhớ tạm.';
      syncStatusEl.className = 'sync-status';
      setTimeout(() => {
        syncStatusEl.textContent = '';
      }, 2000);
    });
  });

  // 6. Direct Channel Connection
  btnSyncGateway.addEventListener('click', async () => {
    const gatewayUrl = inputGateway.value.trim() || 'https://api.stackvid.dev';
    const apiKey = inputApiKey.value.trim();

    if (!apiKey) {
      syncStatusEl.textContent = '✕ Vui lòng nhập API Key (tk_live_...)';
      syncStatusEl.className = 'sync-status error';
      inputApiKey.focus();
      return;
    }

    // Persist input values
    chrome.storage.local.set({
      savedGatewayUrl: gatewayUrl,
      savedApiKey: apiKey,
    });

    syncStatusEl.textContent = '⏳ Đang kết nối kênh vào StackVid...';
    syncStatusEl.className = 'sync-status';
    btnSyncGateway.disabled = true;
    btnSyncText.textContent = 'ĐANG XỬ LÝ...';

    chrome.runtime.sendMessage(
      {
        type: 'SYNC_TO_GATEWAY',
        gatewayUrl,
        apiKey,
        domain: activeDomain,
      },
      (res) => {
        btnSyncGateway.disabled = false;
        btnSyncText.textContent = '⚡ THÊM KÊNH VÀO TÀI KHOẢN';

        if (res?.success) {
          syncStatusEl.textContent = `✓ ${res.message || 'Đã thêm kênh vào tài khoản thành công!'}`;
          syncStatusEl.className = 'sync-status success';
        } else {
          syncStatusEl.textContent = `✕ Thất bại: ${res?.error || 'Lỗi không xác định'}`;
          syncStatusEl.className = 'sync-status error';
        }
      }
    );
  });

  // 7. Live real-time update
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STACKVID_SESSION_UPDATED') {
      if (msg.domain === activeDomain) {
        activeSession = msg.session;
        renderSession(activeSession);
      }
    }
  });
});
