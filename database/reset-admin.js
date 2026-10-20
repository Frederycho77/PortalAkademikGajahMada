/**
 * Reset password admin langsung ke database
 * Jalankan: node database/reset-admin.js
 */
'use strict';
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../src/config/db');

async function resetAdmin() {
  const username  = 'admin_portal';
  const password  = 'Admin@1234';
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

  console.log('🔄 Mereset password admin...');
  const hash = await bcrypt.hash(password, saltRounds);

  const [result] = await pool.query(
    'UPDATE users SET password = ?, is_active = 1 WHERE username = ?',
    [hash, username]
  );

  if (result.affectedRows > 0) {
    console.log('✅ Berhasil!');
    console.log(`   Username : ${username}`);
    console.log(`   Password : ${password}`);
  } else {
    console.log('❌ User tidak ditemukan, jalankan seed dulu.');
  }

  await pool.end();
  process.exit(0);
}

resetAdmin().catch(err => { console.error('Error:', err.message); process.exit(1); });
