# SelfPlanner Backend (FastAPI)

Backend Python riêng cho SelfPlanner, chạy cùng Supabase và hỗ trợ cron + push notification (FCM + email SMTP).

## 1) Cài đặt và chạy local

Yêu cầu:
- Python 3.11+

Chạy:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# hoặc Windows PowerShell:
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## 2) Environment variables

Tạo/sửa `backend/.env`:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
FIREBASE_CREDENTIALS_PATH=service-account.json
FCM_PROJECT_ID=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_USE_TLS=true
```

Khuyến nghị:

```bash
cp .env.example .env
```

## 3) Firebase credentials (FCM)

1. Vào Firebase Console -> Project Settings -> Service accounts.
2. Generate private key JSON.
3. Lưu file JSON vào `backend/service-account.json` (hoặc path khác).
4. Set `FIREBASE_CREDENTIALS_PATH` trỏ tới file này.

Nếu không set credentials hợp lệ, backend vẫn chạy, chỉ là không gửi FCM được.

## 4) API Endpoints

Base prefix: `/api`

- Payments:
  - `GET /api/payments`
  - `POST /api/payments`
  - `PUT /api/payments/{id}`
  - `DELETE /api/payments/{id}`
- Calendar:
  - `GET /api/calendar`
  - `POST /api/calendar`
  - `PUT /api/calendar/{id}`
  - `DELETE /api/calendar/{id}`
- Timeline:
  - `GET /api/timeline`
  - `POST /api/timeline`
  - `PUT /api/timeline/{id}`
  - `DELETE /api/timeline/{id}`
- Notifications:
  - `POST /api/notifications/register-fcm`
  - `GET /api/notifications/status`

Auth:
- Gửi `Authorization: Bearer <supabase_access_token>`
- Backend verify JWT user bằng Supabase Auth.

## 5) Cron job reminder

Cron chạy mỗi giờ tại phút `05` theo timezone `APP_TIMEZONE`:
- Quét `recurring_payments` với `is_active=true`
- Tính kỳ đến hạn theo `billing_anchor_date + interval`
- Tính mốc nhắc theo múi giờ từng tài khoản `user_settings.timezone`
- Đọc `user_settings.reminder_offsets_minutes` để gửi nhắc:
  - trước `n` ngày (ví dụ `1440`, `2880` phút)
  - trước `n` giờ (ví dụ `60`, `180`, `360` phút)
- Gửi thông báo qua:
  - push (`fcm_token`)
  - email (`notification_email` hoặc fallback email tài khoản)

## 6) Deploy

### Railway / Render

1. Tạo service từ thư mục `backend`.
2. Build command:
   - `pip install -r requirements.txt`
3. Start command:
   - `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Set env vars trong dashboard.
5. Nếu dùng file Firebase JSON, upload file secret hoặc mount theo cơ chế provider.

### VPS (systemd)

1. Clone repo, tạo venv, cài requirements.
2. Tạo service `/etc/systemd/system/selfplanner-backend.service`:

```ini
[Unit]
Description=SelfPlanner FastAPI Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/selfplanner/backend
EnvironmentFile=/opt/selfplanner/backend/.env
ExecStart=/opt/selfplanner/backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

3. Enable service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable selfplanner-backend
sudo systemctl start selfplanner-backend
sudo systemctl status selfplanner-backend
```

### VPS (PM2)

```bash
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name selfplanner-backend
pm2 save
pm2 startup
```

## 7) Frontend integration

Trong project Next.js:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api
NEXT_PUBLIC_DATA_PROVIDER=backend
```

Khi dùng `backend`, frontend có thể gọi API thay vì truy cập Supabase trực tiếp.
