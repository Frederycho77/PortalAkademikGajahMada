/**
 * src/middleware/role.middleware.js
 * ---------------------------------------------------------------
 * Middleware Role-Based Access Control (RBAC).
 *
 * Cara penggunaan di route:
 *   router.get('/data-sensitif',
 *     verifyToken,
 *     allowRoles('admin', 'guru'),   // hanya admin & guru
 *     controller.getData
 *   );
 *
 * Role yang tersedia: 'admin' | 'guru' | 'siswa' | 'orang_tua'
 * ---------------------------------------------------------------
 */

'use strict';

const { sendError } = require('../utils/response');

/**
 * allowRoles(...roles)
 * Factory function yang menghasilkan middleware penjaga role.
 * Harus dipanggil SETELAH verifyToken karena butuh req.user.
 *
 * @param {...string} roles - Daftar role yang diizinkan
 * @returns {Function} Express middleware
 */
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Autentikasi diperlukan.', 401);
    }

    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        `Akses ditolak. Hanya ${roles.join(' / ')} yang diizinkan mengakses resource ini.`,
        403
      );
    }

    next();
  };
};

/**
 * isSelf(paramName)
 * Middleware tambahan: pastikan user hanya bisa mengakses data miliknya sendiri.
 * Contoh: siswa hanya bisa lihat nilai miliknya, bukan nilai siswa lain.
 * Admin selalu diizinkan melewati pengecekan ini.
 *
 * @param {string} paramName - Nama URL param yang berisi user_id (default: 'userId')
 */
const isSelf = (paramName = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Autentikasi diperlukan.', 401);
    }

    // Admin boleh akses data siapapun
    if (req.user.role === 'admin') return next();

    const targetId = parseInt(req.params[paramName], 10);

    if (req.user.id !== targetId) {
      return sendError(res, 'Akses ditolak. Anda hanya bisa mengakses data milik Anda sendiri.', 403);
    }

    next();
  };
};

module.exports = { allowRoles, isSelf };
