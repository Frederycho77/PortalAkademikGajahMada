/**
 * src/middleware/validate.middleware.js
 * ---------------------------------------------------------------
 * Middleware untuk menjalankan hasil validasi express-validator.
 * Gunakan setelah mendefinisikan chain validasi di route.
 *
 * Contoh pemakaian di route:
 *   router.post('/login',
 *     body('username').notEmpty(),
 *     body('password').isLength({ min: 6 }),
 *     validate,             // <-- middleware ini
 *     authController.login
 *   );
 * ---------------------------------------------------------------
 */

'use strict';

const { validationResult } = require('express-validator');
const { sendError }        = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format error agar mudah dibaca: { field: "pesan error" }
    const formatted = {};
    errors.array().forEach(err => {
      if (!formatted[err.path]) formatted[err.path] = err.msg;
    });

    return sendError(res, 'Validasi gagal. Periksa kembali inputan Anda.', 422, formatted);
  }

  next();
};

module.exports = { validate };
