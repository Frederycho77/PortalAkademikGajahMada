/**
 * src/controllers/pengumuman.controller.js
 * ---------------------------------------------------------------
 * Papan informasi / pengumuman sekolah.
 *
 * Hak akses:
 *   - GET  (baca)    : semua role (filter by target_role otomatis)
 *   - POST (buat)    : admin, guru
 *   - PUT  (edit)    : admin, atau penulis aslinya (guru)
 *   - DELETE         : admin, atau penulis aslinya
 * ---------------------------------------------------------------
 */

'use strict';

const { pool }     = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/v1/pengumuman
 * Query: page, limit, search, pinned_only
 * Pengumuman yang ditampilkan disesuaikan dengan role user yang login.
 * Pengumuman expired tidak ditampilkan kecuali untuk admin.
 */
const getAllPengumuman = async (req, res) => {
  const { page = 1, limit = 10, search, pinned_only } = req.query;
  const offset   = (parseInt(page) - 1) * parseInt(limit);
  const userRole = req.user.role;

  try {
    let sql = `
      SELECT
        p.id,
        p.judul,
        p.isi,
        p.target_role,
        p.is_pinned,
        p.tanggal_tayang,
        p.tanggal_expired,
        p.lampiran,
        p.created_at,
        u.nama_lengkap AS nama_penulis,
        u.role         AS role_penulis
      FROM pengumuman_sekolah p
      JOIN users u ON u.id = p.penulis_id
      WHERE p.tanggal_tayang <= CURDATE()`;

    const params = [];

    // Pengumuman expired tidak tampil (kecuali admin lihat semua)
    if (userRole !== 'admin') {
      sql += ' AND (p.tanggal_expired IS NULL OR p.tanggal_expired >= CURDATE())';
    }

    // Filter by target_role: tampilkan pengumuman untuk semua (NULL) atau untuk role ini
    if (userRole !== 'admin') {
      sql += ` AND (p.target_role IS NULL OR FIND_IN_SET(?, p.target_role) > 0)`;
      params.push(userRole);
    }

    if (search) {
      sql += ' AND (p.judul LIKE ? OR p.isi LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s);
    }

    if (pinned_only === 'true') {
      sql += ' AND p.is_pinned = 1';
    }

    sql += ' ORDER BY p.is_pinned DESC, p.tanggal_tayang DESC';
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(sql, params);
    return sendSuccess(res, { pengumuman: rows });
  } catch (err) {
    console.error('getAllPengumuman error:', err);
    return sendError(res, 'Gagal mengambil data pengumuman.', 500);
  }
};

/** GET /api/v1/pengumuman/:id — detail satu pengumuman */
const getPengumumanById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.nama_lengkap AS nama_penulis
       FROM pengumuman_sekolah p
       JOIN users u ON u.id = p.penulis_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return sendError(res, 'Pengumuman tidak ditemukan.', 404);
    return sendSuccess(res, rows[0]);
  } catch (err) {
    console.error('getPengumumanById error:', err);
    return sendError(res, 'Gagal mengambil pengumuman.', 500);
  }
};

/** POST /api/v1/pengumuman — buat pengumuman baru */
const createPengumuman = async (req, res) => {
  const {
    judul, isi, target_role, is_pinned,
    tanggal_tayang, tanggal_expired
  } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO pengumuman_sekolah
         (judul, isi, penulis_id, target_role, is_pinned, tanggal_tayang, tanggal_expired)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        judul, isi, req.user.id,
        target_role || null,
        is_pinned ? 1 : 0,
        tanggal_tayang || new Date().toISOString().split('T')[0],
        tanggal_expired || null,
      ]
    );
    return sendSuccess(res, { id: result.insertId }, 'Pengumuman berhasil dibuat', 201);
  } catch (err) {
    console.error('createPengumuman error:', err);
    return sendError(res, 'Gagal membuat pengumuman.', 500);
  }
};

/** PUT /api/v1/pengumuman/:id — edit pengumuman */
const updatePengumuman = async (req, res) => {
  const { id } = req.params;
  const { judul, isi, target_role, is_pinned, tanggal_tayang, tanggal_expired } = req.body;

  try {
    // Pastikan hanya penulis asli atau admin yang boleh edit
    const [existing] = await pool.query(
      'SELECT penulis_id FROM pengumuman_sekolah WHERE id = ?', [id]
    );
    if (existing.length === 0) return sendError(res, 'Pengumuman tidak ditemukan.', 404);

    if (req.user.role !== 'admin' && existing[0].penulis_id !== req.user.id) {
      return sendError(res, 'Anda tidak berhak mengubah pengumuman ini.', 403);
    }

    await pool.query(
      `UPDATE pengumuman_sekolah
       SET judul = ?, isi = ?, target_role = ?, is_pinned = ?,
           tanggal_tayang = ?, tanggal_expired = ?
       WHERE id = ?`,
      [judul, isi, target_role || null, is_pinned ? 1 : 0,
       tanggal_tayang, tanggal_expired || null, id]
    );
    return sendSuccess(res, null, 'Pengumuman berhasil diperbarui');
  } catch (err) {
    console.error('updatePengumuman error:', err);
    return sendError(res, 'Gagal memperbarui pengumuman.', 500);
  }
};

/** DELETE /api/v1/pengumuman/:id */
const deletePengumuman = async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await pool.query(
      'SELECT penulis_id FROM pengumuman_sekolah WHERE id = ?', [id]
    );
    if (existing.length === 0) return sendError(res, 'Pengumuman tidak ditemukan.', 404);

    if (req.user.role !== 'admin' && existing[0].penulis_id !== req.user.id) {
      return sendError(res, 'Anda tidak berhak menghapus pengumuman ini.', 403);
    }

    await pool.query('DELETE FROM pengumuman_sekolah WHERE id = ?', [id]);
    return sendSuccess(res, null, 'Pengumuman berhasil dihapus');
  } catch (err) {
    console.error('deletePengumuman error:', err);
    return sendError(res, 'Gagal menghapus pengumuman.', 500);
  }
};

module.exports = {
  getAllPengumuman, getPengumumanById,
  createPengumuman, updatePengumuman, deletePengumuman
};
