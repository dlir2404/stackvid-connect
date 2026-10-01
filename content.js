/**
 * StackVid Connect - In-Page Floating Widget
 * Non-intrusive floating session capsule injected inside a Shadow DOM.
 */

(function () {
  // Only inject in top window (ignore nested iframes)
  if (window.self !== window.top) return;

  // Prevent multiple instances
  if (document.getElementById('stackvid-connect-host')) return;

  let currentSession = null;
  let isExpanded = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let currentPosX = 24;
  let currentPosY = 24;

  // Create Shadow Host
  const host = document.createElement('div');
  host.id = 'stackvid-connect-host';
  host.style.cssText = `
    position: fixed;
    bottom: ${currentPosY}px;
    right: ${currentPosX}px;
    z-index: 2147483647;
    font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    user-select: none;
    direction: ltr;
  `;
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Stylesheet inside Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: inherit;
      -webkit-font-smoothing: antialiased;
    }

    .stackvid-container {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }

    /* Main Floating Pill */
    .pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px 6px 8px;
      background: rgba(10, 10, 12, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 999px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: default;
    }

    .pill:hover {
      border-color: rgba(255, 255, 255, 0.25);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7), 0 0 16px rgba(6, 182, 212, 0.25);
    }

    /* Logo Mark */
    .brand-mark {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111;
      border: 1px solid rgba(255, 255, 255, 0.12);
      cursor: grab;
      flex-shrink: 0;
    }

    .brand-mark:active {
      cursor: grabbing;
    }

    .brand-svg {
      width: 16px;
      height: 16px;
    }

    /* Status Indicator */
    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }

    .dot-waiting {
      background: #f59e0b;
      box-shadow: 0 0 8px #f59e0b;
      animation: pulse-amber 1.8s infinite;
    }

    .dot-ready {
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }

    .text-waiting {
      color: #d1d5db;
    }

    .text-ready {
      color: #10b981;
    }

    @keyframes pulse-amber {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* Pill Action Buttons */
    .btn-copy {
      display: flex;
      align-items: center;
      gap: 5px;
      background: #ffffff;
      color: #000000;
      border: none;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .btn-copy:hover {
      background: #e4e4e7;
      transform: translateY(-1px);
    }

    .btn-copy:active {
      transform: translateY(0);
    }

    .btn-copy.copied {
      background: #10b981 !important;
      color: #ffffff !important;
    }

    .btn-push-pill {
      display: flex;
      align-items: center;
      gap: 5px;
      background: #06b6d4;
      color: #040814;
      border: none;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .btn-push-pill:hover {
      background: #22d3ee;
      transform: translateY(-1px);
    }

    .btn-push-pill:active {
      transform: translateY(0);
    }

    .btn-push-pill.success {
      background: #10b981 !important;
      color: #ffffff !important;
    }

    .btn-push-pill.error {
      background: #ef4444 !important;
      color: #ffffff !important;
    }

    .btn-toggle {
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px 4px;
      border-radius: 4px;
      transition: color 0.15s;
    }

    .btn-toggle:hover {
      color: #ffffff;
    }

    /* Detail Card (Flyout Popover) */
    .card {
      width: 330px;
      background: rgba(10, 10, 12, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(20px);
      display: none;
      flex-direction: column;
      gap: 10px;
    }

    .card.open {
      display: flex;
      animation: flyin 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes flyin {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 8px;
    }

    .card-title {
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .card-close {
      background: transparent;
      border: none;
      color: #6b7280;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 2px 4px;
    }

    .card-close:hover {
      color: #ffffff;
    }

    .info-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 11px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 6px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 4px;
    }

    .info-label {
      color: #9ca3af;
    }

    .info-value {
      color: #f3f4f6;
      font-weight: 600;
      max-width: 170px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Push Action Section inside Card */
    .push-box {
      background: rgba(6, 182, 212, 0.06);
      border: 1px solid rgba(6, 182, 212, 0.2);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .btn-main-push {
      background: #06b6d4;
      color: #040814;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      border: none;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s ease;
      width: 100%;
    }

    .btn-main-push:hover {
      background: #22d3ee;
      transform: translateY(-1px);
    }

    .btn-main-push:active {
      transform: translateY(0);
    }

    .btn-main-push.success {
      background: #10b981 !important;
      color: #ffffff !important;
    }

    .btn-main-push.error {
      background: #ef4444 !important;
      color: #ffffff !important;
    }

    .key-config-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .modal-key-input {
      flex: 1;
      background: #09090b;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 4px;
      padding: 4px 6px;
      font-size: 10px;
      color: #e5e7eb;
      outline: none;
    }

    .modal-key-input:focus {
      border-color: #06b6d4;
    }

    .btn-save-key {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e5e7eb;
      font-size: 9.5px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-save-key:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    .key-status-text {
      font-size: 9.5px;
      color: #9ca3af;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .key-change-link {
      color: #06b6d4;
      cursor: pointer;
      text-decoration: underline;
    }

    .card-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #e5e7eb;
      font-size: 10px;
      font-weight: 600;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    .btn-secondary.copied {
      background: #10b981 !important;
      border-color: #10b981 !important;
      color: #ffffff !important;
    }

    .btn-clear {
      background: transparent;
      border: 1px dashed rgba(239, 68, 68, 0.3);
      color: #ef4444;
      font-size: 10px;
      padding: 5px 8px;
      border-radius: 6px;
      cursor: pointer;
      grid-column: span 2;
      transition: all 0.15s;
    }

    .btn-clear:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: #ef4444;
    }

    .card-notice {
      font-size: 9.5px;
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 5px;
      padding: 6px 8px;
      line-height: 1.35;
    }
  `;
  shadow.appendChild(style);

  // Widget Markup
  const container = document.createElement('div');
  container.className = 'stackvid-container';

  container.innerHTML = `
    <!-- Detail Card -->
    <div class="card" id="detail-card">
      <div class="card-header">
        <div class="card-title">
          <svg class="brand-svg" viewBox="0 0 24 24" fill="none">
            <path d="M4 1.5h7a2.5 2.5 0 0 1 2.5 2.5V5h-2V4a.5.5 0 0 0-.5-.5H4a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h1v2H4A2.5 2.5 0 0 1 1.5 11V4A2.5 2.5 0 0 1 4 1.5zm4 4h8a2.5 2.5 0 0 1 2.5 2.5V9h-2V8a.5.5 0 0 0-.5-.5H8a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h1v2H8A2.5 2.5 0 0 1 5.5 16V8A2.5 2.5 0 0 1 8 5.5zm4 4h8a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-8a2.5 2.5 0 0 1-2.5-2.5v-8a2.5 2.5 0 0 1 2.5-2.5zm1.5 3v7l6-3.5-6-3.5z" fill="#06B6D4"/>
          </svg>
          STACKVID // SESSION
        </div>
        <button class="card-close" id="btn-close-card" title="Đóng">✕</button>
      </div>

      <div class="info-list">
        <div class="info-row">
          <span class="info-label">Domain</span>
          <span class="info-value" id="val-domain">tiktok.com</span>
        </div>
        <div class="info-row">
          <span class="info-label">Account (odinId)</span>
          <span class="info-value" id="val-odin">—</span>
        </div>
        <div class="info-row">
          <span class="info-label">Cookies</span>
          <span class="info-value" id="val-cookies">0 phát hiện</span>
        </div>
        <div class="info-row">
          <span class="info-label">msToken</span>
          <span class="info-value" id="val-mstoken">—</span>
        </div>
      </div>

      <!-- Push To StackVid Box -->
      <div class="push-box">
        <button class="btn-main-push" id="btn-modal-push">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
          </svg>
          <span id="modal-push-text">⚡ PUSH TO STACKVID (THÊM KÊNH)</span>
        </button>

        <div class="key-config-row" id="key-config-row" style="display: none;">
          <input type="password" id="modal-input-key" placeholder="Dán API Key (tk_live_...)" class="modal-key-input" spellcheck="false" />
          <button class="btn-save-key" id="btn-save-modal-key">LƯU</button>
        </div>

        <div class="key-status-text" id="key-status-row">
          <span id="key-status-label">Chưa có API Key</span>
          <span class="key-change-link" id="key-change-btn">Cài đặt</span>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn-secondary" id="btn-copy-json">📋 Copy JSON</button>
        <button class="btn-secondary" id="btn-copy-cookie">🍪 Copy Cookies</button>
        <button class="btn-clear" id="btn-clear-session">⟳ Xóa & Bắt lại Session</button>
      </div>

      <div class="card-notice">
        ⚠️ Lưu ý: Tuyệt đối không bấm Logout trên web sau khi kết nối. Để quản lý nhiều nick, hãy dùng các Profile Chrome riêng.
      </div>
    </div>

    <!-- Floating Pill -->
    <div class="pill" id="main-pill">
      <div class="brand-mark" id="drag-handle" title="Kéo để di chuyển widget">
        <svg class="brand-svg" viewBox="0 0 24 24" fill="none">
          <path d="M4 1.5h7a2.5 2.5 0 0 1 2.5 2.5V5h-2V4a.5.5 0 0 0-.5-.5H4a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h1v2H4A2.5 2.5 0 0 1 1.5 11V4A2.5 2.5 0 0 1 4 1.5zm4 4h8a2.5 2.5 0 0 1 2.5 2.5V9h-2V8a.5.5 0 0 0-.5-.5H8a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h1v2H8A2.5 2.5 0 0 1 5.5 16V8A2.5 2.5 0 0 1 8 5.5zm4 4h8a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-8a2.5 2.5 0 0 1-2.5-2.5v-8a2.5 2.5 0 0 1 2.5-2.5zm1.5 3v7l6-3.5-6-3.5z" fill="#06B6D4"/>
        </svg>
      </div>

      <div class="status-badge" id="status-badge">
        <span class="dot dot-waiting" id="status-dot"></span>
        <span class="text-waiting" id="status-text">ĐANG CHỜ...</span>
      </div>

      <button class="btn-copy" id="btn-quick-copy" title="Copy Session JSON cho StackVid">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span id="quick-copy-text">COPY</span>
      </button>

      <button class="btn-push-pill" id="btn-quick-push" title="Đẩy session thêm kênh vào tài khoản StackVid">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
        </svg>
        <span id="quick-push-text">PUSH</span>
      </button>

      <button class="btn-toggle" id="btn-toggle-card" title="Xem chi tiết & cài đặt">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
    </div>
  `;

  shadow.appendChild(container);

  // Element References
  const detailCard = shadow.getElementById('detail-card');
  const statusDot = shadow.getElementById('status-dot');
  const statusText = shadow.getElementById('status-text');
  const btnQuickCopy = shadow.getElementById('btn-quick-copy');
  const quickCopyText = shadow.getElementById('quick-copy-text');
  const btnQuickPush = shadow.getElementById('btn-quick-push');
  const quickPushText = shadow.getElementById('quick-push-text');
  const btnToggleCard = shadow.getElementById('btn-toggle-card');
  const btnCloseCard = shadow.getElementById('btn-close-card');

  const valOdin = shadow.getElementById('val-odin');
  const valCookies = shadow.getElementById('val-cookies');
  const valMsToken = shadow.getElementById('val-mstoken');

  const btnModalPush = shadow.getElementById('btn-modal-push');
  const modalPushText = shadow.getElementById('modal-push-text');
  const keyConfigRow = shadow.getElementById('key-config-row');
  const modalInputKey = shadow.getElementById('modal-input-key');
  const btnSaveModalKey = shadow.getElementById('btn-save-modal-key');
  const keyStatusLabel = shadow.getElementById('key-status-label');
  const keyChangeBtn = shadow.getElementById('key-change-btn');

  const btnCopyJson = shadow.getElementById('btn-copy-json');
  const btnCopyCookie = shadow.getElementById('btn-copy-cookie');
  const btnClearSession = shadow.getElementById('btn-clear-session');
  const dragHandle = shadow.getElementById('drag-handle');

  // Dragging support
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = dragStartX - e.clientX;
    const deltaY = dragStartY - e.clientY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    currentPosX = Math.max(10, Math.min(window.innerWidth - 300, currentPosX + deltaX));
    currentPosY = Math.max(10, Math.min(window.innerHeight - 80, currentPosY + deltaY));

    host.style.right = `${currentPosX}px`;
    host.style.bottom = `${currentPosY}px`;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
    }
  });

  // Toggle card
  btnToggleCard.addEventListener('click', () => {
    isExpanded = !isExpanded;
    detailCard.classList.toggle('open', isExpanded);
  });

  btnCloseCard.addEventListener('click', () => {
    isExpanded = false;
    detailCard.classList.remove('open');
  });

  // Refresh Key UI in Card
  function refreshKeyUI() {
    chrome.storage.local.get(['savedApiKey'], (res) => {
      const key = res.savedApiKey?.trim();
      if (key) {
        const masked = `${key.slice(0, 7)}...${key.slice(-4)}`;
        keyStatusLabel.textContent = `🔑 Key: ${masked}`;
        keyChangeBtn.textContent = 'Đổi';
        keyConfigRow.style.display = 'none';
      } else {
        keyStatusLabel.textContent = 'Chưa lưu API Key';
        keyChangeBtn.textContent = 'Cài đặt';
        keyConfigRow.style.display = 'flex';
      }
    });
  }

  refreshKeyUI();

  // Listen for storage changes across tabs/popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.savedApiKey) {
      refreshKeyUI();
    }
  });

  keyChangeBtn.addEventListener('click', () => {
    const isVisible = keyConfigRow.style.display === 'flex';
    keyConfigRow.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) modalInputKey.focus();
  });

  btnSaveModalKey.addEventListener('click', () => {
    const key = modalInputKey.value.trim();
    if (!key) return;
    chrome.storage.local.set({ savedApiKey: key }, () => {
      modalInputKey.value = '';
      refreshKeyUI();
      // Auto trigger push after saving key
      executePushChannel();
    });
  });

  modalInputKey.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnSaveModalKey.click();
    }
  });

  // Execute PUSH Action
  function executePushChannel() {
    if (!currentSession || !currentSession.http) {
      flashElement(btnModalPush, modalPushText, 'CHƯA CÓ SESSION!', false);
      flashElement(btnQuickPush, quickPushText, 'NO DATA', false);
      return;
    }

    chrome.storage.local.get(['savedApiKey', 'savedGatewayUrl'], (stored) => {
      const apiKey = stored.savedApiKey?.trim();
      const gatewayUrl = stored.savedGatewayUrl || 'https://api.stackvid.dev';

      if (!apiKey) {
        // Open card and reveal input if no key saved
        isExpanded = true;
        detailCard.classList.add('open');
        keyConfigRow.style.display = 'flex';
        modalInputKey.focus();
        flashElement(btnModalPush, modalPushText, 'DÁN API KEY VÀO ĐÂY!', false);
        flashElement(btnQuickPush, quickPushText, 'CẦN KEY', false);
        return;
      }

      modalPushText.textContent = '⏳ ĐANG KẾT NỐI...';
      quickPushText.textContent = '...';
      btnModalPush.disabled = true;
      btnQuickPush.disabled = true;

      chrome.runtime.sendMessage(
        {
          type: 'SYNC_TO_GATEWAY',
          gatewayUrl,
          apiKey,
          domain: 'tiktok.com',
        },
        (res) => {
          btnModalPush.disabled = false;
          btnQuickPush.disabled = false;

          if (res?.success) {
            const handle = res.data?.identifier || '';
            const successText = handle ? `✓ ĐÃ THÊM ${handle}` : '✓ ĐÃ THÊM KÊNH!';
            flashElement(btnModalPush, modalPushText, successText, true);
            flashElement(btnQuickPush, quickPushText, '✓ PUSHED', true);
          } else {
            flashElement(btnModalPush, modalPushText, `✕ ${res?.error || 'LỖI'}`, false);
            flashElement(btnQuickPush, quickPushText, 'LỖI', false);
          }
        }
      );
    });
  }

  btnModalPush.addEventListener('click', executePushChannel);
  btnQuickPush.addEventListener('click', executePushChannel);

  // Copy Helpers
  async function copySessionJson(buttonEl, labelEl) {
    if (!currentSession || !currentSession.http) {
      flashElement(buttonEl, labelEl, 'CHƯA CÓ!', false);
      return;
    }
    try {
      const jsonStr = JSON.stringify(currentSession, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      flashElement(buttonEl, labelEl, '✓ COPIED!', true);
    } catch {
      flashElement(buttonEl, labelEl, 'LỖI!', false);
    }
  }

  async function copyRawCookies(buttonEl) {
    const raw = currentSession?.http?.headers?.Cookie || currentSession?.http?.headers?.cookie || '';
    if (!raw) {
      flashElement(buttonEl, null, 'CHƯA CÓ!', false);
      return;
    }
    try {
      await navigator.clipboard.writeText(raw);
      flashElement(buttonEl, null, '✓ COPIED!', true);
    } catch {
      flashElement(buttonEl, null, 'LỖI!', false);
    }
  }

  function flashElement(button, labelSpan, tempText, isSuccess) {
    const origText = labelSpan ? labelSpan.textContent : button.textContent;
    button.classList.add(isSuccess ? 'success' : 'error');
    if (labelSpan) labelSpan.textContent = tempText;
    else button.textContent = tempText;

    setTimeout(() => {
      button.classList.remove('success', 'error');
      if (labelSpan) labelSpan.textContent = origText;
      else button.textContent = origText;
    }, 2000);
  }

  btnQuickCopy.addEventListener('click', () => copySessionJson(btnQuickCopy, quickCopyText));
  btnCopyJson.addEventListener('click', () => copySessionJson(btnCopyJson, null));
  btnCopyCookie.addEventListener('click', () => copyRawCookies(btnCopyCookie));

  // Clear Session
  btnClearSession.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_SESSION', domain: 'tiktok.com' }, () => {
      currentSession = null;
      updateUI(null);
      flashElement(btnClearSession, null, '✓ ĐÃ XÓA', true);
    });
  });

  // Update UI with Session Data
  function updateUI(session) {
    currentSession = session;
    const http = session?.http;

    if (http) {
      statusDot.className = 'dot dot-ready';
      statusText.className = 'text-ready';
      statusText.textContent = 'READY';

      const odin = http.params?.odinId || '—';
      const cookieCount = Object.keys(http.cookies || {}).length;
      const msToken = http.params?.msToken || http.cookies?.msToken;

      valOdin.textContent = odin;
      valCookies.textContent = `${cookieCount} cookies`;
      valMsToken.textContent = msToken ? '✓ Có msToken' : 'Không';
    } else {
      statusDot.className = 'dot dot-waiting';
      statusText.className = 'text-waiting';
      statusText.textContent = 'ĐANG CHỜ...';

      valOdin.textContent = '—';
      valCookies.textContent = '0 phát hiện';
      valMsToken.textContent = '—';
    }
  }

  // Request current session from background
  chrome.runtime.sendMessage({ type: 'GET_SESSION', domain: 'tiktok.com' }, (res) => {
    if (res?.session) {
      updateUI(res.session);
    }
  });

  // Listen for live broadcasts
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STACKVID_SESSION_UPDATED') {
      updateUI(msg.session);
    }
  });
})();
