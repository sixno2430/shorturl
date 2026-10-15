# Snip — ระบบ Short URL

ระบบย่อลิงก์ที่สร้าง Short URL, QR Code และเก็บสถิติการคลิก พัฒนาด้วย **React + Node.js (Express) + PostgreSQL**

- **Live demo:** `https://<your-app>.onrender.com` ← ใส่ URL หลัง deploy
- **Login:** ไม่ต้องใช้ Username/Password

| สร้างลิงก์ | สถิติ |
|---|---|
| ![หน้าสร้างลิงก์](docs/screenshot-home.png) | ![หน้าสถิติ](docs/screenshot-stats.png) |

---

## สารบัญ

1. [ฟีเจอร์](#ฟีเจอร์)
2. [Tech stack](#tech-stack)
3. [การติดตั้งและรันบนเครื่อง](#การติดตั้งและรันบนเครื่อง)
4. [Deploy ขึ้น Free Host](#deploy-ขึ้น-free-host)
5. [Data Flow Diagram (DFD Level 0)](#data-flow-diagram-dfd-level-0)
6. [ER Diagram](#er-diagram)
7. [Architecture Diagram](#architecture-diagram)
8. [API Reference](#api-reference)
9. [การทดสอบ](#การทดสอบ)
10. [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)

---

## ฟีเจอร์

| # | เกณฑ์ในโจทย์ | สิ่งที่ทำ |
|---|---|---|
| 1 | DFD Level 0 | [ดูด้านล่าง](#data-flow-diagram-dfd-level-0) |
| 2 | ER Diagram | [ดูด้านล่าง](#er-diagram) ตาราง `urls` และ `clicks` |
| 3 | สร้าง Short URL และคลิกไป URL ต้นแบบได้ | กรอก URL → ได้ลิงก์ 7 ตัวอักษร (base62) → redirect แบบ 302 |
| 4 | QR Code ของ Short URL | สร้าง QR ทุกลิงก์ สแกนแล้วเปิด URL ต้นแบบ ดาวน์โหลดเป็น PNG ได้ |
| 5 | ประวัติและสถิติ | หน้าประวัติ (ค้นหา, เรียงตามคลิก, แบ่งหน้า, ลบ) และหน้าสถิติ (กราฟรายวัน, อุปกรณ์, เบราว์เซอร์, แหล่งที่มา, คลิกล่าสุด) |
| 6 | ฟีเจอร์เพิ่มเติม | ดูรายการด้านล่าง |

**ฟีเจอร์เพิ่มเติม (ข้อ 6)**

- **ตั้งชื่อลิงก์เอง (custom alias)** เช่น `/synerry` พร้อมตรวจชื่อซ้ำและชื่อที่ระบบสงวนไว้
- **วันหมดอายุของลิงก์** เมื่อหมดอายุจะแสดงหน้า 410 แทนการ redirect
- **แยกสถิติ "คลิกลิงก์" กับ "สแกน QR"** เพราะ QR ชี้ไปที่ `/<code>?src=qr` ทำให้รู้ว่าป้ายหรือสื่อสิ่งพิมพ์ได้ผลแค่ไหน
- **วิเคราะห์อุปกรณ์ เบราว์เซอร์ ระบบปฏิบัติการ และ Referrer** จาก User-Agent
- **ความปลอดภัย:** รับเฉพาะ `http/https` (กัน `javascript:` link), ห้ามย่อลิงก์ของระบบตัวเอง (กัน redirect loop), rate limit การสร้างลิงก์, เก็บ IP เป็น SHA-256 hash ไม่เก็บ IP จริง
- **ใช้งานบนมือถือได้** และรองรับ Dark mode ตามระบบ

---

## Tech stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 19, React Router, Recharts, Vite |
| Backend | Node.js 22, Express 5, `nanoid`, `qrcode`, `ua-parser-js`, `helmet`, `express-rate-limit` |
| Database | PostgreSQL 16 |
| Test | Vitest + Supertest (รันกับ PostgreSQL จริง) |
| Hosting | Render (web service, free) + Neon (PostgreSQL, free) |

---

## การติดตั้งและรันบนเครื่อง

### สิ่งที่ต้องมี

- Node.js 20 ขึ้นไป
- PostgreSQL 14 ขึ้นไป หรือ Docker

### วิธีที่ 1: Docker (ง่ายที่สุด)

```bash
git clone <repo-url> shorturl
cd shorturl
docker compose up --build
```

เปิด <http://localhost:3000> ระบบจะสร้างตารางให้อัตโนมัติตอนเริ่มทำงาน

### วิธีที่ 2: รันด้วย Node.js

**1. เตรียมฐานข้อมูล** (ข้ามได้ถ้ามี PostgreSQL อยู่แล้ว)

```bash
docker compose up -d db
```

**2. ตั้งค่า environment**

```bash
cp server/.env.example server/.env
# แก้ DATABASE_URL ให้ตรงกับฐานข้อมูลของคุณ
```

**3. ติดตั้งและรัน (โหมด development)**

```bash
npm run install:all
npm run dev:server     # terminal ที่ 1 → API ที่ http://localhost:3000
npm run dev:client     # terminal ที่ 2 → เว็บที่ http://localhost:5173
```

ในโหมด dev ให้เปิด <http://localhost:5173> (Vite จะ proxy `/api` ไปที่ Express)

**4. รันแบบ production (service เดียว)**

```bash
npm run build
npm start              # http://localhost:3000
```

### Environment variables

| ตัวแปร | จำเป็น | คำอธิบาย |
|---|---|---|
| `DATABASE_URL` | ✓ | connection string ของ PostgreSQL ถ้ามี `?sslmode=require` จะเปิด SSL ให้อัตโนมัติ |
| `PORT` | | port ของเซิร์ฟเวอร์ (ค่าเริ่มต้น 3000) |
| `PUBLIC_BASE_URL` | | โดเมนที่ใช้สร้าง Short URL และ QR ถ้าไม่ใส่จะใช้โดเมนของ request |
| `IP_HASH_SALT` | | salt สำหรับ hash IP ผู้คลิก |
| `CREATE_RATE_LIMIT` | | จำนวนลิงก์ที่สร้างได้ต่อ IP ต่อนาที (ค่าเริ่มต้น 30) |

---

## Deploy ขึ้น Free Host

ใช้ **Neon** เป็นฐานข้อมูล และ **Render** รันเว็บ ทั้งคู่มี free tier

**1. สร้างฐานข้อมูลบน Neon**

1. สมัครที่ <https://neon.tech> แล้วกด *Create project* (เลือก region Singapore)
2. คัดลอก connection string ที่ลงท้ายด้วย `?sslmode=require`

**2. Deploy บน Render**

1. Push โค้ดขึ้น GitHub
2. ที่ <https://render.com> กด **New → Blueprint** แล้วเลือก repo นี้ (Render จะอ่าน `render.yaml`)
3. ใส่ `DATABASE_URL` เป็น connection string จาก Neon แล้วกด *Apply*
4. รอ build ประมาณ 2–3 นาที แล้วจะได้ URL `https://shorturl-xxxx.onrender.com`

ถ้าไม่ใช้ Blueprint ให้สร้าง **Web Service** เองด้วยค่า: Build `npm run build`, Start `npm start`, Health check `/api/health`

> **หมายเหตุ:** Render free tier จะหลับเมื่อไม่มีคนใช้ 15 นาที การเปิดครั้งแรกหลังหลับจะช้าประมาณ 30–50 วินาที

---

## Data Flow Diagram (DFD Level 0)

```mermaid
flowchart LR
    U[/"ผู้ใช้<br/>(ผู้สร้างลิงก์)"/]
    V[/"ผู้เยี่ยมชม<br/>(ผู้คลิกหรือสแกน QR)"/]

    P(("0<br/>ระบบ<br/>Short URL"))

    D1[("D1 URLs")]
    D2[("D2 Clicks")]

    U -- "URL ต้นฉบับ, ชื่อลิงก์, วันหมดอายุ" --> P
    U -- "คำขอดูประวัติ / สถิติ / ลบลิงก์" --> P
    P -- "Short URL, QR Code" --> U
    P -- "รายการประวัติ, สถิติการคลิก" --> U

    V -- "เปิด Short URL / สแกน QR" --> P
    P -- "Redirect ไปยัง URL ต้นแบบ" --> V

    P -- "บันทึกลิงก์ใหม่" --> D1
    D1 -- "ข้อมูลลิงก์" --> P
    P -- "บันทึกการคลิก" --> D2
    D2 -- "ข้อมูลการคลิก" --> P
```

![DFD Level 0](docs/dfd-level0.png)

**คำอธิบาย**

| Data flow | รายละเอียด |
|---|---|
| ผู้ใช้ → ระบบ | ส่ง URL ที่ต้องการย่อ (และตัวเลือก alias, ชื่อเรียก, วันหมดอายุ) หรือขอดูประวัติและสถิติ |
| ระบบ → ผู้ใช้ | คืน Short URL พร้อม QR Code, รายการประวัติ และสถิติการคลิก |
| ผู้เยี่ยมชม → ระบบ | เปิด Short URL หรือสแกน QR Code |
| ระบบ → ผู้เยี่ยมชม | Redirect (HTTP 302) ไปยัง URL ต้นแบบ หรือแจ้ง 404 / 410 |
| ระบบ ↔ D1 URLs | บันทึกและค้นหาลิงก์จาก `short_code` |
| ระบบ ↔ D2 Clicks | บันทึกการคลิกแต่ละครั้ง และสรุปสถิติ |

---

## ER Diagram

```mermaid
erDiagram
    URLS ||--o{ CLICKS : "has"

    URLS {
        bigserial   id PK
        varchar     short_code UK "รหัสสั้น หรือ custom alias"
        text        original_url "URL ต้นแบบ"
        varchar     title "ชื่อเรียก (ไม่บังคับ)"
        boolean     is_custom "ตั้งชื่อเองหรือไม่"
        integer     click_count "จำนวนคลิกสะสม"
        timestamptz expires_at "วันหมดอายุ (null = ไม่หมดอายุ)"
        timestamptz created_at
    }

    CLICKS {
        bigserial   id PK
        bigint      url_id FK
        timestamptz clicked_at
        varchar     source "link หรือ qr"
        text        referrer
        text        user_agent
        varchar     browser
        varchar     os
        varchar     device "desktop, mobile, tablet, bot"
        varchar     ip_hash "SHA-256 ของ IP"
    }
```

![ER Diagram](docs/er-diagram.png)

**เหตุผลในการออกแบบ**

- `short_code` เป็น `UNIQUE` ทำให้ redirect ค้นหาด้วย index ได้เร็ว และกัน alias ซ้ำที่ระดับฐานข้อมูล
- `click_count` เก็บไว้ในตาราง `urls` (denormalized) เพื่อให้หน้าประวัติไม่ต้อง `COUNT` ตาราง `clicks` ทุกครั้ง ส่วนรายละเอียดแต่ละคลิกเก็บใน `clicks` สำหรับทำสถิติ
- `clicks.url_id` เป็น `ON DELETE CASCADE` ลบลิงก์แล้วสถิติหายตามไปด้วย
- Index `(url_id, clicked_at DESC)` ใช้กับการดึงสถิติรายวันและคลิกล่าสุด

---

## Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["Browser"]
        SPA["React SPA<br/>หน้าสร้างลิงก์ · ประวัติ · สถิติ"]
        Scan["มือถือสแกน QR /<br/>คลิก Short URL"]
    end

    subgraph Render["Render Web Service (Node.js 22)"]
        direction TB
        Static["Static files<br/>(React build)"]
        API["REST API /api/*<br/>Express 5"]
        Redirect["Redirect /:code<br/>302 + บันทึกคลิก"]
        QR["QR generator<br/>(qrcode)"]
        UA["UA parser +<br/>IP hashing"]
    end

    DB[("PostgreSQL<br/>(Neon)")]

    SPA -- "HTTPS" --> Static
    SPA -- "JSON" --> API
    Scan -- "GET /abc123" --> Redirect
    API --> QR
    Redirect --> UA
    API -- "SQL" --> DB
    Redirect -- "SQL" --> DB
    Redirect -. "302 Location" .-> Scan
```

![Architecture](docs/architecture.png)

**ลำดับการทำงานของ redirect:** ค้นหา `short_code` → ตรวจวันหมดอายุ → ตอบ `302` ทันที → บันทึกการคลิกหลังจากตอบแล้ว ผู้เยี่ยมชมจึงไม่ต้องรอการเขียนฐานข้อมูล ใช้ `302` และ `Cache-Control: no-store` แทน `301` เพราะ `301` ถูกเบราว์เซอร์ cache ไว้ ทำให้นับคลิกซ้ำไม่ได้

**แนวทางขยายเป็น Microservice:** โค้ดแยกส่วนไว้แล้ว สามารถแยกเป็น 3 service ได้แก่ *Shortener* (สร้างและจัดการลิงก์), *Redirect* (รับ traffic สูงสุด ใส่ Redis cache ได้) และ *Analytics* (รับ event การคลิกผ่าน queue แล้วสรุปสถิติ) โดยแต่ละ service scale แยกกันได้

---

## API Reference

| Method | Path | คำอธิบาย |
|---|---|---|
| `POST` | `/api/urls` | สร้าง Short URL body: `{ url, alias?, title?, expiresAt? }` |
| `GET` | `/api/urls` | ประวัติ query: `search`, `sort=recent\|clicks`, `page`, `limit` |
| `GET` | `/api/urls/:code` | ข้อมูลลิงก์ |
| `DELETE` | `/api/urls/:code` | ลบลิงก์และสถิติ |
| `GET` | `/api/urls/:code/qr` | QR Code (`format=svg`, `size`, `download=1`) |
| `GET` | `/api/urls/:code/stats` | สถิติ query: `days`, `tz` |
| `GET` | `/api/health` | health check |
| `GET` | `/:code` | Redirect ไปยัง URL ต้นแบบ |

**ตัวอย่าง**

```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.synerry.com","alias":"synerry"}'
```

```json
{
  "code": "synerry",
  "shortUrl": "http://localhost:3000/synerry",
  "originalUrl": "https://www.synerry.com/",
  "clicks": 0,
  "isCustom": true
}
```

| สถานะ | ความหมาย |
|---|---|
| `400` | URL หรือ alias ไม่ถูกต้อง |
| `409` | alias ถูกใช้แล้ว |
| `410` | ลิงก์หมดอายุ |
| `429` | สร้างลิงก์ถี่เกินไป |

---

## การทดสอบ

Test รันกับ PostgreSQL จริง **ควรใช้ฐานข้อมูลแยกสำหรับทดสอบ เพราะ test จะล้างข้อมูลก่อนเริ่ม**

```bash
createdb shorturl_test
DATABASE_URL=postgres://postgres:postgres@localhost:5432/shorturl_test npm test
```

ครอบคลุม 13 กรณี: การตรวจ URL และ alias, สร้างลิงก์, redirect และนับคลิก, QR Code, แยกสถิติ QR กับลิงก์, ประวัติและการค้นหา, alias ซ้ำ, ลิงก์หมดอายุ, ลิงก์ที่ไม่มีอยู่ และการลบ

---

## โครงสร้างโปรเจกต์

```
shorturl/
├── client/                  # React (Vite)
│   └── src/
│       ├── pages/           # Home, History, Stats
│       ├── components.jsx   # ResultCard, LinkRow, CopyButton
│       ├── api.js           # เรียก REST API
│       └── styles.css
├── server/                  # Express API
│   ├── src/
│   │   ├── app.js           # routes: API, QR, stats, redirect
│   │   ├── db.js            # PostgreSQL pool + migration
│   │   ├── schema.sql       # ตาราง urls, clicks
│   │   ├── validate.js      # ตรวจ URL, alias, วันหมดอายุ
│   │   └── index.js         # entry point
│   └── test/api.test.js
├── Dockerfile
├── docker-compose.yml
└── render.yaml              # Render Blueprint
```
