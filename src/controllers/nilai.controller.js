/**
 * src/controllers/nilai.controller.js
 * ---------------------------------------------------------------
 * Pengelolaan nilai siswa.
 *
 * Hak akses:
 *   - GET  (lihat nilai)  : semua role (siswa hanya lihat miliknya)
 *   - POST (input nilai)  : guru, admin
 *   - PUT  (edit nilai)   : guru (pengampu mapel itu), admin
 *   - DELETE              : admin
 * ---------------------------------------------------------------
 */

'use strict';

const { pool }     = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/v1/nilai/siswa/:siswaId
 * Query params: semester, tahun_ajaran
 * Ambil semua nilai seorang siswa untuk satu semester.
 */
const getNilaiBySiswa = async (req, res) => {
  const { siswaId } = req.params;
  const { semester, tahun_ajaran } = req.query;

  // Siswa hanya bisa lihat nilai dirinya sendiri
  if (req.user.role === 'siswa') {
    const [sp] = await pool.query(
      'SELECT id FROM siswa_profile WHERE user_id = ?', [req.user.id]
    );
    if (sp.length === 0 || sp[0].id !== parseInt(siswaId)) {
      return sendError(res, 'Anda hanya bisa melihat nilai milik Anda sendiri.', 403);
    }
  }

  // Orang tua hanya bisa lihat nilai anak yang terhubung
  if (req.user.role === 'orang_tua') {
    const [check] = await pool.query(
      `SELECT sp.id FROM siswa_profile sp
       JOIN users u ON u.id = sp.orang_tua_id
       WHERE u.id = ? AND sp.id = ?`,
      [req.user.id, siswaId]
    );
    if (check.length === 0) {
      return sendError(res, 'Anda tidak memiliki akses ke data siswa ini.', 403);
    }
  }

  try {
    let sql = `
      SELECT
        n.id,
        mp.kode_mapel,
        mp.nama_mapel,
        mp.kkm,
        n.semester,
        n.tahun_ajaran,
        n.nilai_harian,
        n.nilai_uts,
        n.nilai_uas,
        n.nilai_akhir,
        n.keterangan,
        u.nama_lengkap AS nama_guru
      FROM nilai_siswa n
      JOIN mata_pelajaran mp ON mp.id = n.mapel_id
      JOIN guru_profile gp   ON gp.id = n.guru_id
      JOIN users u           ON u.id  = gp.user_id
      WHERE n.siswa_id = ?`;

    const params = [siswaId];

    if (semester) { sql += ' AND n.semester = ?'; params.push(semester); }
    if (tahun_ajaran) { sql += ' AND n.tahun_ajaran = ?'; params.push(tahun_ajaran); }

    sql += ' ORDER BY mp.nama_mapel ASC';

    const [rows] = await pool.query(sql, params);

    // Hitung rata-rata nilai akhir
    const rataRata = rows.length > 0
      ? (rows.reduce((sum, r) => sum + (parseFloat(r.nilai_akhir) || 0), 0) / rows.length).toFixed(2)
      : null;

    return sendSuccess(res, { nilai: rows, rata_rata: rataRata });
  } catch (err) {
    console.error('getNilaiBySiswa error:', err);
    return sendError(res, 'Gagal mengambil data nilai.', 500);
  }
};

/**
 * POST /api/v1/nilai
 * Body: { siswa_id, mapel_id, kelas_id, semester, tahun_ajaran,
 *          nilai_harian, nilai_uts, nilai_uas }
 * Hanya guru & admin.
 */
const inputNilai = async (req, res) => {
  const {
    siswa_id, mapel_id, kelas_id, semester,
    tahun_ajaran, nilai_harian, nilai_uts, nilai_uas
  } = req.body;

  try {
    // Ambil guru_id dari user yang login
    let guru_id;
    if (req.user.role === 'guru') {
      const [gp] = await pool.query(
        'SELECT id FROM guru_profile WHERE user_id = ?', [req.user.id]
      );
      if (gp.length === 0) return sendError(res, 'Profil guru tidak ditemukan.', 404);
      guru_id = gp[0].id;
    } else {
      // Admin bisa spesifikan guru_id di body
      guru_id = req.body.guru_id;
      if (!guru_id) return sendError(res, 'guru_id diperlukan untuk admin.', 400);
    }

    const [result] = await pool.query(
      `INSERT INTO nilai_siswa
         (siswa_id, mapel_id, kelas_id, guru_id, semester, tahun_ajaran,
          nilai_harian, nilai_uts, nilai_uas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nilai_harian = VALUES(nilai_harian),
         nilai_uts    = VALUES(nilai_uts),
         nilai_uas    = VALUES(nilai_uas),
         guru_id      = VALUES(guru_id)`,
      [siswa_id, mapel_id, kelas_id, guru_id, semester, tahun_ajaran,
       nilai_harian ?? null, nilai_uts ?? null, nilai_uas ?? null]
    );

    const action = result.affectedRows === 1 ? 'diinput' : 'diperbarui';
    return sendSuccess(res, { id: result.insertId || null }, `Nilai berhasil ${action}`, 201);
  } catch (err) {
    console.error('inputNilai error:', err);
    return sendError(res, 'Gagal menyimpan nilai.', 500);
  }
};

/**
 * PUT /api/v1/nilai/:id
 * Body: { nilai_harian?, nilai_uts?, nilai_uas? }
 */
const updateNilai = async (req, res) => {
  const { id } = req.params;
  const { nilai_harian, nilai_uts, nilai_uas } = req.body;

  try {
    // Guru hanya bisa update nilai yang dia input
    if (req.user.role === 'guru') {
      const [gp] = await pool.query(
        'SELECT id FROM guru_profile WHERE user_id = ?', [req.user.id]
      );
      const [cek] = await pool.query(
        'SELECT id FROM nilai_siswa WHERE id = ? AND guru_id = ?', [id, gp[0]?.id]
      );
      if (cek.length === 0) {
        return sendError(res, 'Anda tidak memiliki akses untuk mengubah nilai ini.', 403);
      }
    }

    const [result] = await pool.query(
      `UPDATE nilai_siswa
       SET nilai_harian = COALESCE(?, nilai_harian),
           nilai_uts    = COALESCE(?, nilai_uts),
           nilai_uas    = COALESCE(?, nilai_uas)
       WHERE id = ?`,
      [nilai_harian ?? null, nilai_uts ?? null, nilai_uas ?? null, id]
    );

    if (result.affectedRows === 0) return sendError(res, 'Data nilai tidak ditemukan.', 404);
    return sendSuccess(res, null, 'Nilai berhasil diperbarui');
  } catch (err) {
    console.error('updateNilai error:', err);
    return sendError(res, 'Gagal memperbarui nilai.', 500);
  }
};

/** DELETE /api/v1/nilai/:id — hanya admin */
const deleteNilai = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM nilai_siswa WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return sendError(res, 'Data nilai tidak ditemukan.', 404);
    return sendSuccess(res, null, 'Data nilai berhasil dihapus');
  } catch (err) {
    console.error('deleteNilai error:', err);
    return sendError(res, 'Gagal menghapus nilai.', 500);
  }
};

module.exports = { getNilaiBySiswa, inputNilai, updateNilai, deleteNilai };
