/**
 * src/config/db.js
 * ---------------------------------------------------------------
 * Konfigurasi koneksi database MySQL menggunakan mysql2/promise.
 * Menggunakan Connection Pool agar koneksi lebih efisien dan
 * tidak perlu membuka/menutup koneksi di setiap query.
 * ---------------------------------------------------------------
 */

'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

// Buat connection pool
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'smas_gajah_mada',

  // Jumlah koneksi maksimum dalam pool
  connectionLimit:    10,

  // Tunggu jika semua koneksi sedang dipakai (ms)
  waitForConnections: true,
  queueLimit:         0,

  // Konversi tipe data MySQL ke tipe JS secara otomatis
  typeCast: true,

  // Timezone server (sesuaikan dengan zona waktu server)
  timezone: '+07:00',
});

/**
 * Fungsi helper untuk menguji koneksi saat server pertama kali start.
 * Dipanggil dari server.js.
 */
async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('✅  Database MySQL terhubung — Host:', process.env.DB_HOST, '| DB:', process.env.DB_NAME);
    connection.release();
  } catch (err) {
    console.error('❌  Gagal terhubung ke MySQL:', err.message);
    // Keluar dari proses agar server tidak berjalan tanpa DB
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
