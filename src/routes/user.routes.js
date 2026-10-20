/**
 * src/routes/user.routes.js
 * Prefix di server.js: /api/v1/users
 * Semua route di sini hanya bisa diakses oleh ADMIN.
 */

'use strict';

const { Router }    = require('express');
const { body, param } = require('express-validator');
const ctrl          = require('../controllers/user.controller');
const { verifyToken }  = require('../middleware/auth.middleware');
const { allowRoles }   = require('../middleware/role.middleware');
const { validate }     = require('../middleware/validate.middleware');

const router  = Router();
const isAdmin = [verifyToken, allowRoles('admin')];

// GET  /api/v1/users
router.get('/', ...isAdmin, ctrl.getAllUsers);

// POST /api/v1/users
router.post('/',
  ...isAdmin,
  [
    body('username').trim().isLength({ min: 4, max: 50 }).withMessage('Username 4–50 karakter'),
    body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter'),
    body('role').isIn(['admin','guru','siswa','orang_tua']).withMessage('Role tidak valid'),
    body('nama_lengkap').trim().notEmpty().withMessage('Nama lengkap wajib diisi'),
    body('email').optional({ nullable: true }).isEmail().withMessage('Format email tidak valid'),
  ],
  validate,
  ctrl.createUser
);

// PUT /api/v1/users/:id
router.put('/:id',
  ...isAdmin,
  [
    param('id').isInt({ gt: 0 }).withMessage('ID tidak valid'),
    body('nama_lengkap').trim().notEmpty().withMessage('Nama lengkap wajib diisi'),
  ],
  validate,
  ctrl.updateUser
);

// DELETE /api/v1/users/:id
router.delete('/:id',
  ...isAdmin,
  [param('id').isInt({ gt: 0 }).withMessage('ID tidak valid')],
  validate,
  ctrl.deleteUser
);

module.exports = router;
