/**
 * StackVid Connect - Background Service Worker (Manifest V3)
 * Pure HTTP & REST Session Collector for StackVid Multi-Platform Publishing.
 * Intercepts TikTok creator authentication headers, cookies, and query tokens.
 */

const STORAGE_KEY = 'stackvid_sessions';

// Cache in memory for instant synchronous lookups
const sessionsMemoryCache = {};

/**
 * Initialize listeners
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('⚡ StackVid Connect installed');
  loadCachedSessions();
});

chrome.runtime.onStartup.addListener(() => {
  loadCachedSessions();
});

async function loadCachedSessions() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    if (data[STORAGE_KEY]) {
      Object.assign(sessionsMemoryCache, data[STORAGE_KEY]);
    }
  } catch (err) {
    console.error('Failed to load cached sessions:', err);
  }
}

/**
 * Intercept Request Headers to detect authentications
 */
chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    try {
      await processRequestHeaders(details);
    } catch (err) {
      console.error('Error processing request headers:', err);
    }
  },
  { urls: ['*://*.tiktok.com/*', '*://*.facebook.com/*'] },
  ['requestHeaders', 'extraHeaders']
);

/**
 * Inspect request headers and determine if it qualifies as a target session
 */
async function processRequestHeaders(details) {
  const url = details.url;
  const domain = getDomainFromUrl(url);

  // Pure HTTP: only xmlhttprequest, fetch, or top-level navigation
  const isHttp = details.type === 'xmlhttprequest' || details.type === 'fetch' || details.type === 'main_frame';
  if (!isHttp) return;

  const headers = details.requestHeaders || [];
  const headerMap = {};
  for (const h of headers) {
    if (!h.name.startsWith(':')) {
      headerMap[h.name] = h.value;
    }
  }

  const cookieHeader = headerMap['Cookie'] || headerMap['cookie'] || '';
  const parsedCookies = parseCookieString(cookieHeader);
  const parsedParams = parseUrlParams(url);

  let isMatch = false;
  let targetDomain = domain;

  // 1. TikTok Detection
  if (domain.includes('tiktok.com') || domain.includes('byteoversea.com') || domain.includes('ibytedtos.com')) {
    targetDomain = 'tiktok.com';

    // Look for essential identifiers: odinId OR (msToken AND device_id) OR sessionid cookie
    const hasOdin = parsedParams.odinId || cookieHeader.includes('odinId') || cookieHeader.includes('odin_tt');
    const hasSessionId = parsedCookies.sessionid || cookieHeader.includes('sessionid=');
    const hasMsToken = parsedParams.msToken || parsedCookies.msToken || cookieHeader.includes('msToken');
    const hasDeviceId = parsedParams.device_id || parsedCookies.device_id;

    // Must be an API request or have strong credential markers
    if ((hasOdin && (hasMsToken || hasDeviceId)) || (hasSessionId && hasOdin)) {
      isMatch = true;
    }
  }

  // 2. Facebook Detection
  else if (domain.includes('facebook.com') || domain.includes('fb.com')) {
    targetDomain = 'facebook.com';
    const hasCUser = parsedCookies.c_user || cookieHeader.includes('c_user=');
    const hasXs = parsedCookies.xs || cookieHeader.includes('xs=');
    if (hasCUser && hasXs && (url.includes('/api/') || url.includes('graphql'))) {
      isMatch = true;
    }
  }

  if (!isMatch) return;

  const requestRecord = {
    type: details.type,
    url: details.url,
    method: details.method,
    timestamp: new Date().toISOString(),
    headers: headerMap,
    params: parsedParams,
    cookies: parsedCookies,
  };

  if (!sessionsMemoryCache[targetDomain]) {
    sessionsMemoryCache[targetDomain] = {};
  }

  const existing = sessionsMemoryCache[targetDomain];
  const existingScore = evaluateScore(existing.http);
  const newScore = evaluateScore(requestRecord);

  // Prefer requests that contain odinId & sessionid
  if (newScore >= existingScore || !existing.http) {
    existing.http = requestRecord;
    existing.updatedAt = new Date().toISOString();
    await persistSessions();
    broadcastSessionUpdate(targetDomain, existing);
  }
}

/**
 * Score a candidate session to keep the highest quality session (with odinId, sessionid)
 */
function evaluateScore(record) {
  if (!record) return 0;
  let score = 0;
  const p = record.params || {};
  const c = record.cookies || {};
  const rawCookie = record.headers?.Cookie || record.headers?.cookie || '';

  if (p.odinId) score += 40;
  if (c.sessionid || rawCookie.includes('sessionid=')) score += 30;
  if (c.ttwid || rawCookie.includes('ttwid=')) score += 15;
  if (p.msToken || c.msToken) score += 15;
  if (p.device_id) score += 10;
  if (p.secUid) score += 10;

  return score;
}

/**
 * Save in-memory sessions to chrome.storage.local
 */
async function persistSessions() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: sessionsMemoryCache });
  } catch (err) {
    console.error('Failed to persist session to local storage:', err);
  }
}

/**
 * Broadcast update to open tabs & extension popup
 */
function broadcastSessionUpdate(domain, sessionData) {
  const exportPayload = formatForExport(sessionData);

  // Notify extension popup if open
  chrome.runtime.sendMessage({
    type: 'STACKVID_SESSION_UPDATED',
    domain,
    session: exportPayload,
  }).catch(() => {});

  // Notify content script in tabs
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id && tab.url && tab.url.includes(domain)) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'STACKVID_SESSION_UPDATED',
          domain,
          session: exportPayload,
        }).catch(() => {});
      }
    }
  });
}

/**
 * Format session to match StackVid expected schema
 */
function formatForExport(sessionData) {
  if (!sessionData || !sessionData.http) return null;
  return {
    http: {
      type: sessionData.http.type,
      url: sessionData.http.url,
      method: sessionData.http.method,
      timestamp: sessionData.http.timestamp || new Date().toISOString(),
      headers: sessionData.http.headers || {},
      params: sessionData.http.params || {},
      cookies: sessionData.http.cookies || {},
    },
  };
}

/**
 * Message Dispatcher
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SESSION') {
    const domain = message.domain || 'tiktok.com';
    const raw = sessionsMemoryCache[domain];
    const formatted = formatForExport(raw);
    sendResponse({ success: true, session: formatted, domain });
    return true;
  }

  if (message.type === 'CLEAR_SESSION') {
    const domain = message.domain;
    if (domain && sessionsMemoryCache[domain]) {
      delete sessionsMemoryCache[domain];
    } else {
      for (const k in sessionsMemoryCache) delete sessionsMemoryCache[k];
    }
    persistSessions().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'SYNC_TO_GATEWAY') {
    handleSyncToGateway(message.gatewayUrl, message.apiKey, message.domain)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Connect channel & sync session directly to StackVid API Gateway (POST /api/channels)
 * Automatically associates the channel with the user matching X-API-Key.
 */
async function handleSyncToGateway(gatewayUrl, apiKey, domain = 'tiktok.com') {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Vui lòng nhập API Key của bạn (bắt đầu bằng tk_live_...)');
  }

  const session = formatForExport(sessionsMemoryCache[domain]);
  if (!session || !session.http) {
    throw new Error(`Chưa có session hợp lệ cho ${domain}. Vui lòng lướt trang TikTok trước.`);
  }

  const cleanApiKey = apiKey.trim();
  const baseUrl = (gatewayUrl || 'https://api.stackvid.dev').replace(/\/+$/, '');
  const channelsUrl = `${baseUrl}/api/channels`;

  // 1. First attempt: Create channel for the authenticated user
  const createRes = await fetch(channelsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': cleanApiKey,
    },
    body: JSON.stringify({
      platform: 'TIKTOK',
      credentials: session,
    }),
  });

  if (createRes.status === 201 || createRes.status === 200) {
    const data = await createRes.json();
    const handle = data.identifier ? ` (${data.identifier})` : '';
    return {
      success: true,
      action: 'created',
      data,
      message: `Đã thêm kênh "${data.name}"${handle} vào tài khoản thành công!`,
    };
  }

  if (createRes.status === 401) {
    throw new Error('API Key không hợp lệ hoặc đã bị vô hiệu hóa.');
  }

  // 2. If 409 Conflict (channel name or account already exists for user), update its session!
  if (createRes.status === 409) {
    try {
      const listRes = await fetch(channelsUrl, {
        headers: { 'X-API-Key': cleanApiKey },
      });

      if (listRes.ok) {
        const channels = await listRes.json();
        const odinId = session.http.params?.odinId;

        // Find existing channel matching this account or fallback to first TikTok channel
        const matched =
          channels.find((c) => {
            if (c.platform !== 'TIKTOK') return false;
            if (odinId && JSON.stringify(c.credentials || '').includes(odinId)) return true;
            return false;
          }) ||
          channels.find((c) => c.platform === 'TIKTOK') ||
          channels[0];

        if (matched) {
          const patchRes = await fetch(`${channelsUrl}/${matched.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': cleanApiKey,
            },
            body: JSON.stringify({
              credentials: session,
              status: 'ACTIVE',
            }),
          });

          if (patchRes.ok) {
            const updated = await patchRes.json();
            const handle = updated.identifier ? ` (${updated.identifier})` : '';
            return {
              success: true,
              action: 'updated',
              data: updated,
              message: `Đã cập nhật session mới nhất cho kênh "${updated.name}"${handle}!`,
            };
          }
        }
      }
    } catch (err) {
      console.warn('Fallback update channel failed:', err);
    }
  }

  const errText = await createRes.text();
  try {
    const errJson = JSON.parse(errText);
    throw new Error(errJson.message || `Lỗi ${createRes.status}`);
  } catch {
    throw new Error(`Lỗi ${createRes.status}: ${errText.slice(0, 100)}`);
  }
}

/**
 * Utility Helpers
 */
function getDomainFromUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const parts = parsed.hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return parsed.hostname;
  } catch {
    return 'unknown';
  }
}

function parseUrlParams(urlString) {
  try {
    const parsed = new URL(urlString);
    const params = new URLSearchParams(parsed.search);
    return Object.fromEntries(params.entries());
  } catch {
    return {};
  }
}

function parseCookieString(cookieString) {
  if (!cookieString) return {};
  const cookies = {};
  const pairs = cookieString.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const name = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      if (name) {
        cookies[name] = val;
      }
    }
  }
  return cookies;
}
