# StackVid Connect (Chrome Extension MV3)

> **Extension gọn nhẹ, bảo mật cao chuyên dụng cho StackVid** giúp tự động trích xuất thông tin phiên làm việc, Cookie, Tokens (`odinId`, `msToken`, `sessionid`, `ttwid`) từ TikTok Web & Facebook để phục vụ kết nối kênh và xuất bản video tự động qua API.

---

## ⚡ Tính Năng Chính

1. **Giao diện Terminal Tối Giản (StackVid Aesthetic):**
   - 100% typography `Geist Mono` monospace, tone pitch-black `#000000`, viền hairline `rgba(255, 255, 255, 0.08)`.
   - **Floating Capsule trực tiếp trên trang:** Tự động hiển thị tại góc màn hình TikTok / Facebook, hỗ trợ kéo thả tự do.
   - **Thao tác 1-Click:** Bấm nút `COPY` ngay trên capsule nổi để copy Session JSON vào clipboard.

2. **Cách Ly Tuyệt Đối với Shadow DOM:**
   - Capsule nổi được bọc hoàn toàn trong Shadow DOM, không bị ảnh hưởng bởi stylesheet của trang web máy chủ.

3. **Tự Động Nhận Diện & Lọc Session:**
   - Tự động lọc và giữ lại request chứa thông tin định danh Creator (`odinId`) và trạng thái đăng nhập (`sessionid`).

4. **Đầu Ra Chuẩn Cho StackVid API & Dashboard:**
   - **Session JSON:** Dùng trực tiếp cho `POST /api/tiktok/session` và `POST /api/tiktok/upload`.
   - **Raw Cookies:** Dán vào form **Kết nối Kênh** trên Dashboard.

---

## 📦 Hướng Dẫn Cài Đặt (Developer Mode)

1. Mở trình duyệt Chrome / Edge / Brave / Cốc Cốc.
2. Truy cập `chrome://extensions/`.
3. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)**.
4. Bấm nút **Tải phần mở rộng đã giải nén (Load unpacked)**.
5. Chọn thư mục:
   ```
   /Users/dlir/code/stackvid-connect
   ```

---

## 🚀 Hướng Dẫn Sử Dụng

### Cách 1: Sử dụng Floating Widget trên trang TikTok
1. Truy cập `https://www.tiktok.com` và đăng nhập tài khoản Creator.
2. Lướt xem 1–2 video hoặc mở trang cá nhân của bạn.
3. Thanh capsule StackVid ở góc màn hình sẽ chuyển sang trạng thái `READY` (xanh ngọc).
4. Bấm nút **`COPY`** trên thanh capsule.
5. *(Tùy chọn)* Bấm mũi tên `▾` để xem chi tiết `odinId` hoặc copy riêng chuỗi Raw Cookies.

### Cách 2: Sử dụng Popup trên thanh công cụ
1. Bấm vào icon StackVid trên thanh tiện ích của trình duyệt.
2. Dán API Key của bạn (`tk_live_...`) và bấm **`⚡ THÊM KÊNH VÀO TÀI KHOẢN`**.
3. Hệ thống sẽ tự động đăng ký kênh TikTok dưới tài khoản StackVid của bạn mà không cần thao tác thủ công trên Dashboard.

---

## ⚠️ Lưu Ý Quan Trọng: Duy Trì Phiên & Quản Lý Đa Tài Khoản

* **Tuyệt đối KHÔNG bấm Đăng xuất (Log out) trên web TikTok sau khi kết nối:**
  - Ngay khi người dùng bấm Đăng xuất trên giao diện web TikTok, máy chủ TikTok sẽ ngay lập tức vô hiệu hóa phiên làm việc (`sessionid`) trên toàn hệ thống. Kênh kết nối trong StackVid sẽ mất quyền và chuyển sang trạng thái `EXPIRED`.
* **Best Practice khi quản lý nhiều tài khoản TikTok:**
  - Sử dụng **nhiều Profile Chrome riêng biệt** (hoặc mở cửa sổ Ẩn danh - Incognito) cho từng tài khoản TikTok khác nhau.
  - Khi đã bấm thêm kênh vào StackVid thành công, bạn chỉ cần đóng tab hoặc đóng cửa sổ Chrome đó lại — **tuyệt đối không bấm Log out**. Phiên làm việc sẽ được duy trì bền bỉ dài hạn.

---

## 📋 Cấu Trúc Dữ Liệu Đầu Ra (Output Schema)

```json
{
  "http": {
    "type": "xmlhttprequest",
    "url": "https://www.tiktok.com/api/user/following/request/list/?...",
    "method": "GET",
    "timestamp": "2026-10-01T09:45:00.000Z",
    "headers": {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
      "Cookie": "sessionid=464150fba...; ttwid=1%7C...; msToken=...",
      "Referer": "https://www.tiktok.com/"
    },
    "params": {
      "odinId": "7248907244315444229",
      "device_id": "7687068190372103698",
      "msToken": "x7OVOoWLN_dH1AabuBe0fk...",
      "region": "VN"
    },
    "cookies": {
      "sessionid": "464150fba...",
      "ttwid": "1%7C...",
      "msToken": "x7OVOoWLN_dH1AabuBe0fk...",
      "odin_tt": "beb28690dad3a3c9..."
    },
    "body": null
  }
}
```

---

## 🛠️ Cấu Trúc Mã Nguồn

```
stackvid-connect/
├── manifest.json       # Manifest V3 configuration & permissions
├── background.js       # Background service worker (request inspection & session store)
├── content.js          # In-page Shadow DOM floating capsule & copy button
├── popup.html          # Toolbar popup UI
├── popup.css           # Pitch-black Geist Mono terminal styling
├── popup.js            # Popup actions & API gateway sync logic
├── icons/              # Transparent PNG & SVG brand icons (16, 32, 48, 128)
└── README.md           # Hướng dẫn cài đặt & sử dụng
```
