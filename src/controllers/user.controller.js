/**
 * src/controllers/user.controller.js
 * ---------------------------------------------------------------
 * Manajemen user: hanya untuk ADMIN.
 * Fitur: list semua user, buat user baru, update, soft-delete.
 * ---------------------------------------------------------------
 */

'use strict';

const bcrypt       = require('bcrypt');
const { pool }     = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/** GET /api/v1/users — ambil semua user, bisa filter by role */
const getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT id, username, role, nama_lengkap, email, no_hp, is_active, created_at
      FROM users WHERE 1=1`;
    const params = [];

    if (role) { sql += ' AND role = ?'; params.push(role); }
    if (search) {
      sql += ' AND (nama_lengkap LIKE ? OR username LIKE ? OR email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(sql, params);

    // Total untuk pagination
    let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];
    if (role) { countSql += ' AND role = ?'; countParams.push(role); }
    if (search) {
      countSql += ' AND (nama_lengkap LIKE ? OR username LIKE ? OR email LIKE ?)';
      const s = `%${search}%`;
      countParams.push(s, s, s);
    }
    const [[{ total }]] = await pool.query(countSql, countParams);

    return sendSuccess(res, {
      users: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getAllUsers error:', err);
    return sendError(res, 'Gagal mengambil data user.', 500);
  }
};

/** POST /api/v1/users — buat user baru */
const createUser = async (req, res) => {
  const { username, password, role, nama_lengkap, email, no_hp } = req.body;

  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const hashedPw   = await bcrypt.hash(password, saltRounds);

    const [result] = await pool.query(
      `INSERT INTO users (username, password, role, nama_lengkap, email, no_hp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hashedPw, role, nama_lengkap, email || null, no_hp || null]
    );

    return sendSuccess(res, { id: result.insertId }, 'User berhasil dibuat', 201);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return sendError(res, 'Username atau email sudah digunakan.', 409);
    }
    console.error('createUser error:', err);
    return sendError(res, 'Gagal membuat user.', 500);
  }
};

/** PUT /api/v1/users/:id — update data user */
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { nama_lengkap, email, no_hp, is_active } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE users SET nama_lengkap = ?, email = ?, no_hp = ?, is_active = ?
       WHERE id = ?`,
      [nama_lengkap, email || null, no_hp || null, is_active ?? 1, id]
    );

    if (result.affectedRows === 0) return sendError(res, 'User tidak ditemukan.', 404);
    return sendSuccess(res, null, 'Data user berhasil diperbarui');
  } catch (err) {
    console.error('updateUser error:', err);
    return sendError(res, 'Gagal memperbarui user.', 500);
  }
};

/** DELETE /api/v1/users/:id — soft delete (set is_active = 0) */
const deleteUser = async (req, res) => {
  const { id } = req.params;

  // Jangan hapus diri sendiri
  if (parseInt(id) === req.user.id) {
    return sendError(res, 'Tidak dapat menonaktifkan akun Anda sendiri.', 400);
  }

  try {
    const [result] = await pool.query(
      'UPDATE users SET is_active = 0 WHERE id = ?', [id]
    );

    if (result.affectedRows === 0) return sendError(res, 'User tidak ditemukan.', 404);
    return sendSuccess(res, null, 'Akun user berhasil dinonaktifkan');
  } catch (err) {
    console.error('deleteUser error:', err);
    return sendError(res, 'Gagal menonaktifkan user.', 500);
  }
};

module.exports = { getAllUsers, createUser, updateUser, deleteUser };
