# Mathend App

Mathend adalah workspace catatan matematis dengan **Agent Panel** yang sekarang support:

- OAuth provider untuk `Codex GitHub Copilot`
- OAuth provider untuk `Claude Code AI`
- Chat panel berbasis provider yang terhubung

## Hybrid Math Writing (No-code style)

Editor utama sekarang mendukung mode hybrid:

- Buka command palette dengan `Ctrl+K` atau ketik `/`
- Cari dengan kata natural (`pecahan`, `integral`, `matriks`, `teorema`, `bukti`, dll)
- Intent parser otomatis untuk query natural (contoh: `integral 0 sampai tak hingga of e^(-x)`)
- Pilih command via keyboard (`Arrow`, `Enter`, `Tab`, `Esc`)
- Live panel **Paper Preview** di kanan untuk render Typst style (A4-like)
- Export asli via Typst: `PDF` dan `PNG`

Dependensi Typst runtime sudah ditambahkan:

- `@myriaddreamin/typst-all-in-one.ts`

## Jalankan lokal

Dari root monorepo:

```bash
bun run dev
```

App ini jalan di `http://localhost:3000`.

## Setup OAuth env

1. Copy template env:

```bash
cp apps/mathend/.env.example apps/mathend/.env.local
```

2. Isi value pada `apps/mathend/.env.local`.

Contoh variabel:

- `MATHEND_GITHUB_COPILOT_CLIENT_ID`
- `MATHEND_CLAUDE_CODE_CLIENT_ID`
- `MATHEND_CLAUDE_CODE_CLIENT_SECRET`
- dan endpoint auth/token provider sesuai platform OAuth yang dipakai
- optional live chat endpoint/model:
  - `MATHEND_GITHUB_COPILOT_CHAT_ENDPOINT`
  - `MATHEND_GITHUB_COPILOT_CHAT_MODEL`
  - `MATHEND_CLAUDE_CODE_CHAT_ENDPOINT`
  - `MATHEND_CLAUDE_CODE_CHAT_MODEL`
  - `MATHEND_GITHUB_MODELS_PAT` (opsional, untuk GitHub Models langsung)
  - `MATHEND_GITHUB_MODELS_ORG` (opsional)

Catatan:

- GitHub Copilot sekarang pakai device authorization flow (kode verifikasi), jadi cukup `MATHEND_GITHUB_COPILOT_CLIENT_ID` dan endpoint default GitHub.
- `MATHEND_GITHUB_COPILOT_CLIENT_SECRET` tidak wajib untuk flow GitHub device code.
- Untuk Claude Code AI, isi `AUTH_URL` dan `TOKEN_URL` sesuai penyedia OAuth yang kamu gunakan.
- Untuk GitHub Copilot chat, kamu bisa pakai OAuth token hasil login, atau set `MATHEND_GITHUB_MODELS_PAT` agar request chat diarahkan ke `models.github.ai`.

## Setup Gumroad license (wajib untuk akses workspace)

Mathend sekarang menggunakan aktivasi lisensi Gumroad sebelum editor bisa dibuka.

1. Buat product Gumroad dan aktifkan license key.
2. Isi env berikut di `apps/mathend/.env.local`:

```bash
GUMROAD_PRODUCT_ID=
GUMROAD_API_BASE=https://api.gumroad.com
GUMROAD_CHECKOUT_URL=https://muhamsyad.gumroad.com/l/mathend
LICENSE_COOKIE_SECRET=
LICENSE_REVERIFY_DAYS=7
```

Catatan:

- `GUMROAD_PRODUCT_ID` dan `LICENSE_COOKIE_SECRET` wajib di server.
- Jika belum diisi, app akan tetap menampilkan layar aktivasi lisensi.

## Callback URL

Callback path yang dipakai aplikasi:

- `http://localhost:3000/api/oauth/callback/github-copilot`
- `http://localhost:3000/api/oauth/callback/claude-code`

Daftarkan URL callback ini pada OAuth app provider terkait.

## API yang tersedia

- `GET /api/oauth/providers` -> status provider (configured/connected)
- `POST /api/oauth/connect` -> mulai OAuth flow (GitHub return device code, provider lain return authorize URL)
- `POST /api/oauth/device/poll` -> polling status device code sampai GitHub login selesai
- `GET /api/oauth/callback/[providerId]` -> callback + token exchange
- `POST /api/oauth/disconnect` -> putuskan koneksi provider
- `POST /api/agent/chat` -> kirim message ke agent panel (provider live jika endpoint tersedia)
- `GET /api/license/status` -> cek status lisensi browser saat ini
- `POST /api/license/activate` -> aktivasi lisensi Gumroad
- `POST /api/license/deactivate` -> hapus sesi lisensi browser saat ini

## Verifikasi

Sudah diverifikasi dengan:

```bash
bun run --filter mathend check-types
bun run --filter mathend lint
```
