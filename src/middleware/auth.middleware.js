/**
 * src/middleware/auth.middleware.js
 * ---------------------------------------------------------------
 * Middleware autentikasi berbasis JWT.
 *
 * Cara kerja:
 *   1. Ambil token dari header "Authorization: Bearer <token>"
 *   2. Verifikasi token dengan JWT_SECRET
 *   3. Simpan payload (id, role, dll.) ke req.user
 *   4. Panggil next() jika valid, atau return 401 jika tidak
 * ---------------------------------------------------------------
 */

'use strict';

const jwt       = require('jsonwebtoken');
const { sendError } = require('../utils/response');

/**
 * verifyToken
 * Middleware untuk memastikan request datang dengan JWT yang valid.
 * Gunakan ini di semua route yang membutuhkan autentikasi.
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // Cek apakah header Authorization ada dan formatnya "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Akses ditolak. Token tidak ditemukan.', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verifikasi token — akan throw error jika expired atau tidak valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Simpan data user dari payload ke req.user agar bisa dipakai di controller
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Sesi Anda telah berakhir. Silakan login kembali.', 401);
    }
    return sendError(res, 'Token tidak valid.', 401);
  }
};

module.exports = { verifyToken };
