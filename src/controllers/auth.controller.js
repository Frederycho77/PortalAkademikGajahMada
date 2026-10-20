/**
 * src/controllers/auth.controller.js
 * ---------------------------------------------------------------
 * Controller untuk autentikasi: login, logout (token blacklist
 * sederhana via client-side), dan get profil user yang login.
 * ---------------------------------------------------------------
 */

'use strict';

const bcrypt        = require('bcrypt');
const jwt           = require('jsonwebtoken');
const { pool }      = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/v1/auth/login
 * Body: { username, password }
 *
 * Alur:
 *   1. Cari user berdasarkan username
 *   2. Bandingkan password dengan bcrypt
 *   3. Buat JWT dengan payload { id, username, role, nama_lengkap }
 *   4. Return token + info user
 */
const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Cari user — gunakan parameterized query (cegah SQL injection)
    const [rows] = await pool.query(
      'SELECT id, username, password, role, nama_lengkap, email, foto_profil, is_active FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      // Pesan generik agar tidak membocorkan info username valid/tidak
      return sendError(res, 'Username atau password salah.', 401);
    }

    const user = rows[0];

    // 2. Cek apakah akun aktif
    if (!user.is_active) {
      return sendError(res, 'Akun Anda dinonaktifkan. Hubungi administrator.', 403);
    }

    // 3. Verifikasi password dengan bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 'Username atau password salah.', 401);
    }

    // 4. Buat JWT payload (jangan masukkan password!)
    const payload = {
      id:           user.id,
      username:     user.username,
      role:         user.role,
      nama_lengkap: user.nama_lengkap,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    // 5. Ambil profile_id jika siswa/guru (untuk keperluan frontend)
    let profileId = null;
    if (user.role === 'siswa') {
      const [sp] = await pool.query(
        'SELECT id, nis, kelas_id FROM siswa_profile WHERE user_id = ?', [user.id]
      );
      if (sp.length > 0) profileId = sp[0];
    } else if (user.role === 'guru') {
      const [gp] = await pool.query(
        'SELECT id, nip FROM guru_profile WHERE user_id = ?', [user.id]
      );
      if (gp.length > 0) profileId = gp[0];
    }

    return sendSuccess(res, {
      token,
      user: {
        id:           user.id,
        username:     user.username,
        role:         user.role,
        nama_lengkap: user.nama_lengkap,
        email:        user.email,
        foto_profil:  user.foto_profil,
        profile:      profileId,
      },
    }, 'Login berhasil');

  } catch (err) {
    console.error('Login error:', err);
    return sendError(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * GET /api/v1/auth/me
 * Header: Authorization: Bearer <token>
 * Mengembalikan data user yang sedang login.
 */
const getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.role, u.nama_lengkap, u.email, u.no_hp, u.foto_profil
       FROM users u WHERE u.id = ? AND u.is_active = 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return sendError(res, 'User tidak ditemukan.', 404);
    }

    return sendSuccess(res, rows[0], 'Data profil berhasil diambil');
  } catch (err) {
    console.error('getMe error:', err);
    return sendError(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * POST /api/v1/auth/change-password
 * Body: { password_lama, password_baru }
 */
const changePassword = async (req, res) => {
  const { password_lama, password_baru } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT password FROM users WHERE id = ?', [req.user.id]
    );

    if (rows.length === 0) return sendError(res, 'User tidak ditemukan.', 404);

    const isMatch = await bcrypt.compare(password_lama, rows[0].password);
    if (!isMatch) return sendError(res, 'Password lama tidak sesuai.', 400);

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const hashed = await bcrypt.hash(password_baru, saltRounds);

    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    return sendSuccess(res, null, 'Password berhasil diubah');
  } catch (err) {
    console.error('changePassword error:', err);
    return sendError(res, 'Terjadi kesalahan server.', 500);
  }
};

module.exports = { login, getMe, changePassword };
