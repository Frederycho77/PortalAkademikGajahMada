/**
 * src/routes/auth.routes.js
 * Prefix di server.js: /api/v1/auth
 */

'use strict';

const { Router }        = require('express');
const { body }          = require('express-validator');
const { login, getMe, changePassword } = require('../controllers/auth.controller');
const { verifyToken }   = require('../middleware/auth.middleware');
const { validate }      = require('../middleware/validate.middleware');

const router = Router();

// POST /api/v1/auth/login
router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Username wajib diisi'),
    body('password').notEmpty().withMessage('Password wajib diisi'),
  ],
  validate,
  login
);

// GET /api/v1/auth/me  — butuh token
router.get('/me', verifyToken, getMe);

// POST /api/v1/auth/change-password
router.post('/change-password',
  verifyToken,
  [
    body('password_lama').notEmpty().withMessage('Password lama wajib diisi'),
    body('password_baru')
      .isLength({ min: 8 }).withMessage('Password baru minimal 8 karakter')
      .matches(/[A-Z]/).withMessage('Password harus mengandung huruf kapital')
      .matches(/[0-9]/).withMessage('Password harus mengandung angka'),
  ],
  validate,
  changePassword
);

module.exports = router;
