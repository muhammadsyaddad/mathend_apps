# Test Strategy

Folder ini dipakai sebagai gate kualitas sebelum push ke GitHub.

## Tujuan

- memastikan behavior inti tetap benar saat code berubah
- mencegah regresi di UI shared components dan flow utama app
- memberi sinyal cepat lewat CI sebelum merge

## Cakupan sekarang

- `test/mathend`: flow test utama untuk halaman library dan modal export
- `test/docs`: trust check untuk behavior shared button

## Cara jalanin

- semua test: `bun run test`
- mode watch: `bun run test:watch`
- test + coverage: `bun run test:coverage`
- full gate lokal: `bun run verify`

## Aturan menambah test

- simpan file test di bawah `test/` dengan struktur mirroring source
- nama file: `*.test.ts` atau `*.test.tsx`
- fokus ke perilaku user-visible dan logic penting
- kalau ada bug fix, tambah minimal satu test yang menangkap bug tersebut
