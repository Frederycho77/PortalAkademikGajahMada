/**
 * src/routes/absensi.routes.js
 * Prefix di server.js: /api/v1/absensi
 */

'use strict';

const { Router }       = require('express');
const { body, param }  = require('express-validator');
const ctrl             = require('../controllers/absensi.controller');
const { verifyToken }  = require('../middleware/auth.middleware');
const { allowRoles }   = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');

const router = Router();

// GET /api/v1/absensi/siswa/:siswaId
router.get('/siswa/:siswaId',
  verifyToken,
  allowRoles('admin', 'guru', 'siswa', 'orang_tua'),
  ctrl.getAbsensiBySiswa
);

// GET /api/v1/absensi/rekap-kelas/:kelasId — guru & admin
router.get('/rekap-kelas/:kelasId',
  verifyToken,
  allowRoles('admin', 'guru'),
  ctrl.getRekapKelas
);

// POST /api/v1/absensi/bulk — input absensi massal
router.post('/bulk',
  verifyToken,
  allowRoles('admin', 'guru'),
  [
    body('kelas_id').isInt({ gt: 0 }).withMessage('kelas_id tidak valid'),
    body('tanggal').isDate().withMessage('Format tanggal tidak valid (YYYY-MM-DD)'),
    body('data').isArray({ min: 1 }).withMessage('Data absensi tidak boleh kosong'),
    body('data.*.siswa_id').isInt({ gt: 0 }).withMessage('siswa_id tidak valid'),
    body('data.*.status').isIn(['H','I','S','A']).withMessage('Status harus H/I/S/A'),
  ],
  validate,
  ctrl.inputAbsensiBulk
);

// PUT /api/v1/absensi/:id — koreksi absensi
router.put('/:id',
  verifyToken,
  allowRoles('admin', 'guru'),
  [
    param('id').isInt({ gt: 0 }).withMessage('ID tidak valid'),
    body('status').isIn(['H','I','S','A']).withMessage('Status harus H/I/S/A'),
  ],
  validate,
  ctrl.updateAbsensi
);

module.exports = router;
