/**
 * src/routes/nilai.routes.js
 * Prefix di server.js: /api/v1/nilai
 */

'use strict';

const { Router }       = require('express');
const { body, param }  = require('express-validator');
const ctrl             = require('../controllers/nilai.controller');
const { verifyToken }  = require('../middleware/auth.middleware');
const { allowRoles }   = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');

const router = Router();

// GET /api/v1/nilai/siswa/:siswaId
// Semua role bisa, tapi ada pembatasan di controller
router.get('/siswa/:siswaId',
  verifyToken,
  allowRoles('admin', 'guru', 'siswa', 'orang_tua'),
  ctrl.getNilaiBySiswa
);

// POST /api/v1/nilai — input nilai baru
router.post('/',
  verifyToken,
  allowRoles('admin', 'guru'),
  [
    body('siswa_id').isInt({ gt: 0 }).withMessage('siswa_id tidak valid'),
    body('mapel_id').isInt({ gt: 0 }).withMessage('mapel_id tidak valid'),
    body('kelas_id').isInt({ gt: 0 }).withMessage('kelas_id tidak valid'),
    body('semester').isIn([1, 2]).withMessage('Semester harus 1 atau 2'),
    body('tahun_ajaran').matches(/^\d{4}\/\d{4}$/).withMessage('Format tahun_ajaran: 2024/2025'),
    body('nilai_harian').optional().isFloat({ min: 0, max: 100 }).withMessage('Nilai harian 0–100'),
    body('nilai_uts').optional().isFloat({ min: 0, max: 100 }).withMessage('Nilai UTS 0–100'),
    body('nilai_uas').optional().isFloat({ min: 0, max: 100 }).withMessage('Nilai UAS 0–100'),
  ],
  validate,
  ctrl.inputNilai
);

// PUT /api/v1/nilai/:id
router.put('/:id',
  verifyToken,
  allowRoles('admin', 'guru'),
  [
    param('id').isInt({ gt: 0 }).withMessage('ID tidak valid'),
    body('nilai_harian').optional().isFloat({ min: 0, max: 100 }),
    body('nilai_uts').optional().isFloat({ min: 0, max: 100 }),
    body('nilai_uas').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  ctrl.updateNilai
);

// DELETE /api/v1/nilai/:id — hanya admin
router.delete('/:id',
  verifyToken,
  allowRoles('admin'),
  ctrl.deleteNilai
);

module.exports = router;
