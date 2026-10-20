# Daftar Akun Portal Akademik SMA Gajah Mada Binjai

> Edit file ini sesuai kebutuhan, lalu salin nilai ke `seed.js`.
> Setelah edit `seed.js`, jalankan: `node database/seed.js`

---

## Akun Saat Ini

| No | Username        | Password     | Role        | Nama Lengkap              |
|----|-----------------|--------------|-------------|---------------------------|
| 1  | admin_portal    | Admin@1234   | admin       | Administrator Portal      |
| 2  | guru_budi       | Guru@1234    | guru        | Budi Santoso, S.Pd        |
| 3  | guru_siti       | Guru@5678    | guru        | Siti Rahayu, S.Pd         |
| 4  | siswa_rizky     | Siswa@1234   | siswa       | Rizky Pratama             |
| 5  | siswa_dewi      | Siswa@5678   | siswa       | Dewi Lestari              |
| 6  | siswa_fajar     | Siswa@9012   | siswa       | Fajar Nugroho             |
| 7  | ortu_ahmad      | Ortu@1234    | orang_tua   | Ahmad Wijaya              |

---

## Cara Ubah Username & Password

### 1. Edit tabel di atas sesuai keinginan

Contoh — ingin ubah admin:
```
username : admin_smagm
password : RahasiaKuat@2025
```

### 2. Salin ke bagian ini di `seed.js`

**Bagian password (baris ~30):**
```js
const [
  hashAdmin, hashGuru1, hashGuru2,
  hashSiswa1, hashSiswa2, hashSiswa3,
  hashOrtu
] = await Promise.all([
  bcrypt.hash('Admin@1234',  SALT_ROUNDS),  // ← No.1 admin
  bcrypt.hash('Guru@1234',   SALT_ROUNDS),  // ← No.2 guru_budi
  bcrypt.hash('Guru@5678',   SALT_ROUNDS),  // ← No.3 guru_siti
  bcrypt.hash('Siswa@1234',  SALT_ROUNDS),  // ← No.4 siswa_rizky
  bcrypt.hash('Siswa@5678',  SALT_ROUNDS),  // ← No.5 siswa_dewi
  bcrypt.hash('Siswa@9012',  SALT_ROUNDS),  // ← No.6 siswa_fajar
  bcrypt.hash('Ortu@1234',   SALT_ROUNDS),  // ← No.7 ortu_ahmad
]);
```

**Bagian username & nama (baris ~50):**
```js
// Admin
['admin_portal', hashAdmin]   // ← ganti 'admin_portal'

// Guru 1
['guru_budi', hashGuru1]      // ← ganti 'guru_budi'

// Guru 2
['guru_siti', hashGuru2]      // ← ganti 'guru_siti'

// Orang Tua
['ortu_ahmad', hashOrtu]      // ← ganti 'ortu_ahmad'

// Siswa 1
['siswa_rizky', hashSiswa1]   // ← ganti 'siswa_rizky'

// Siswa 2
['siswa_dewi', hashSiswa2]    // ← ganti 'siswa_dewi'

// Siswa 3
['siswa_fajar', hashSiswa3]   // ← ganti 'siswa_fajar'
```

### 3. Jalankan seed ulang

```powershell
cd d:\Kiro_Project\PORTALAKADEMIK
node database/seed.js
```

---

## Aturan Password

Password harus memenuhi:
- Minimal **8 karakter**
- Mengandung **huruf kapital** (A-Z)
- Mengandung **angka** (0-9)

Contoh password yang valid:
- `Sekolah@2025`
- `GajahMada1`
- `Admin99!`
