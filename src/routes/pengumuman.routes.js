/**
 * src/routes/pengumuman.routes.js
 * Prefix di server.js: /api/v1/pengumuman
 */

'use strict';

const { Router }       = require('express');
const { body, param }  = require('express-validator');
const ctrl             = require('../controllers/pengumuman.controller');
const { verifyToken }  = require('../middleware/auth.middleware');
const { allowRoles }   = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');

const router = Router();

// GET /api/v1/pengumuman — baca semua pengumuman (semua role)
router.get('/', verifyToken, ctrl.getAllPengumuman);

// GET /api/v1/pengumuman/:id
router.get('/:id', verifyToken, ctrl.getPengumumanById);

// POST /api/v1/pengumuman — buat pengumuman (admin & guru)
router.post('/',
  verifyToken,
  allowRoles('admin', 'guru'),
  [
    body('judul').trim().isLength({ min: 5, max: 200 }).withMessage('Judul 5–200 karakter'),
    body('isi').trim().notEmpty().withMessage('Isi pengumuman tidak boleh kosong'),
    body('tanggal_tayang').optional().isDate().withMessage('Format tanggal tidak valid'),
    body('tanggal_expired').optional({ nullable: true }).isDate().withMessage('Format tanggal tidak valid'),
  ],
  validate,
  ctrl.createPengumuman
);

// PUT /api/v1/pengumuman/:id
router.put('/:id',
  verifyToken,
  allowRoles('admin', 'guru'),
  [
    param('id').isInt({ gt: 0 }),
    body('judul').trim().isLength({ min: 5, max: 200 }).withMessage('Judul 5–200 karakter'),
    body('isi').trim().notEmpty().withMessage('Isi pengumuman tidak boleh kosong'),
  ],
  validate,
  ctrl.updatePengumuman
);

// DELETE /api/v1/pengumuman/:id
router.delete('/:id',
  verifyToken,
  allowRoles('admin', 'guru'),
  ctrl.deletePengumuman
);

module.exports = router;
