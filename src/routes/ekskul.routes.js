/**
 * src/routes/ekskul.routes.js
 * Prefix di server.js: /api/v1/ekskul
 *
 * PETA ENDPOINT:
 *   GET    /                              → list semua ekskul
 *   GET    /:id                           → detail satu ekskul
 *   POST   /                              → buat ekskul (admin)
 *   PUT    /:id                           → update ekskul (admin)
 *   DELETE /:id                           → soft delete ekskul (admin)
 *   POST   /daftar                        → daftar ekskul (siswa) ⭐ quota check
 *   GET    /pendaftaran/saya              → cek status daftar (siswa)
 *   GET    /:ekskulId/peserta             → list peserta (admin/guru)
 *   PATCH  /pendaftaran/:id/status        → terima/tolak (admin/guru)
 *   DELETE /pendaftaran/:id/batal         → batalkan (siswa)
 */

'use strict';

const { Router }        = require('express');
const { body, param }   = require('express-validator');
const ctrl              = require('../controllers/ekskul.controller');
const { verifyToken }   = require('../middleware/auth.middleware');
const { allowRoles }    = require('../middleware/role.middleware');
const { validate }      = require('../middleware/validate.middleware');

const router = Router();

// ── Route statis HARUS didefinisikan SEBELUM route dinamis (:id) ──

// GET /api/v1/ekskul/pendaftaran/saya — siswa lihat pendaftarannya
router.get('/pendaftaran/saya',
  verifyToken,
  allowRoles('siswa'),
  ctrl.getPendaftaranSaya
);

// POST /api/v1/ekskul/daftar — PENDAFTARAN EKSKUL (fitur utama)
router.post('/daftar',
  verifyToken,
  allowRoles('siswa'),
  [
    body('ekskul_id')
      .isInt({ gt: 0 })
      .withMessage('ekskul_id harus berupa angka positif'),
  ],
  validate,
  ctrl.daftarEkskul
);

// PATCH /api/v1/ekskul/pendaftaran/:pendaftaranId/status — admin/guru kelola status
router.patch('/pendaftaran/:pendaftaranId/status',
  verifyToken,
  allowRoles('admin', 'guru'),
  [
    param('pendaftaranId').isInt({ gt: 0 }).withMessage('ID tidak valid'),
    body('status')
      .isIn(['diterima', 'ditolak'])
      .withMessage('Status harus "diterima" atau "ditolak"'),
  ],
  validate,
  ctrl.updateStatusPendaftaran
);

// DELETE /api/v1/ekskul/pendaftaran/:pendaftaranId/batal — siswa batalkan
router.delete('/pendaftaran/:pendaftaranId/batal',
  verifyToken,
  allowRoles('siswa'),
  [param('pendaftaranId').isInt({ gt: 0 }).withMessage('ID tidak valid')],
  validate,
  ctrl.batalPendaftaran
);

// ── Route Dinamis ──────────────────────────────────────────────

// GET /api/v1/ekskul — semua role
router.get('/', verifyToken, ctrl.getAllEkskul);

// GET /api/v1/ekskul/:id — detail ekskul
router.get('/:id',
  verifyToken,
  [param('id').isInt({ gt: 0 }).withMessage('ID tidak valid')],
  validate,
  ctrl.getEkskulById
);

// GET /api/v1/ekskul/:ekskulId/peserta — admin & guru
router.get('/:ekskulId/peserta',
  verifyToken,
  allowRoles('admin', 'guru'),
  ctrl.getPesertaEkskul
);

// POST /api/v1/ekskul — buat ekskul baru (admin)
router.post('/',
  verifyToken,
  allowRoles('admin'),
  [
    body('nama_ekskul').trim().isLength({ min: 3, max: 100 }).withMessage('Nama ekskul 3–100 karakter'),
    body('jadwal').trim().notEmpty().withMessage('Jadwal wajib diisi'),
    body('kuota_max').isInt({ gt: 0, max: 200 }).withMessage('Kuota maksimal 1–200'),
    body('biaya').optional().isFloat({ min: 0 }).withMessage('Biaya tidak valid'),
  ],
  validate,
  ctrl.createEkskul
);

// PUT /api/v1/ekskul/:id — update ekskul (admin)
router.put('/:id',
  verifyToken,
  allowRoles('admin'),
  [
    param('id').isInt({ gt: 0 }),
    body('nama_ekskul').trim().isLength({ min: 3, max: 100 }),
    body('jadwal').trim().notEmpty(),
    body('kuota_max').isInt({ gt: 0, max: 200 }),
  ],
  validate,
  ctrl.updateEkskul
);

// DELETE /api/v1/ekskul/:id — soft delete (admin)
router.delete('/:id',
  verifyToken,
  allowRoles('admin'),
  [param('id').isInt({ gt: 0 })],
  validate,
  ctrl.deleteEkskul
);

module.exports = router;
