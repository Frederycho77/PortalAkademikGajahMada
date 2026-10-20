/**
 * src/utils/response.js
 * ---------------------------------------------------------------
 * Helper untuk format respons API yang konsisten.
 * Semua endpoint menggunakan fungsi ini agar struktur JSON
 * selalu seragam dan mudah dikonsumsi oleh frontend.
 * ---------------------------------------------------------------
 */

'use strict';

/**
 * Kirim respons sukses
 * @param {object} res   - Express response object
 * @param {*}      data  - Data payload
 * @param {string} message
 * @param {number} statusCode - HTTP status (default 200)
 */
const sendSuccess = (res, data = null, message = 'Berhasil', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Kirim respons error
 * @param {object} res
 * @param {string} message
 * @param {number} statusCode - HTTP status (default 400)
 * @param {*}      errors     - Detail validasi error (opsional)
 */
const sendError = (res, message = 'Terjadi kesalahan', statusCode = 400, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

module.exports = { sendSuccess, sendError };
