/**
 * src/controllers/absensi.controller.js
 * ---------------------------------------------------------------
 * Pengelolaan absensi / kehadiran siswa.
 *
 * Hak akses:
 *   - GET  (lihat rekap)   : semua role (siswa hanya miliknya)
 *   - POST (input absensi) : guru, admin
 *   - PUT  (koreksi)       : guru (hari yang sama), admin
 * ---------------------------------------------------------------
 */

'use strict';

const { pool }     = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/v1/absensi/siswa/:siswaId
 * Query: bulan (1–12), tahun, mapel_id
 * Menampilkan rekap absensi bulanan + ringkasan H/I/S/A.
 */
const getAbsensiBySiswa = async (req, res) => {
  const { siswaId } = req.params;
  const { bulan, tahun, mapel_id } = req.query;

  // Validasi hak akses siswa
  if (req.user.role === 'siswa') {
    const [sp] = await pool.query(
      'SELECT id FROM siswa_profile WHERE user_id = ?', [req.user.id]
    );
    if (sp.length === 0 || sp[0].id !== parseInt(siswaId)) {
      return sendError(res, 'Anda hanya bisa melihat absensi milik Anda sendiri.', 403);
    }
  }

  try {
    let sql = `
      SELECT
        a.id,
        a.tanggal,
        a.status,
        a.keterangan,
        mp.nama_mapel,
        u.nama_lengkap AS nama_guru
      FROM absensi a
      LEFT JOIN mata_pelajaran mp ON mp.id = a.mapel_id
      JOIN guru_profile gp ON gp.id = a.guru_id
      JOIN users u ON u.id = gp.user_id
      WHERE a.siswa_id = ?`;

    const params = [siswaId];

    if (bulan && tahun) {
      sql += ' AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?';
      params.push(bulan, tahun);
    }
    if (mapel_id) { sql += ' AND a.mapel_id = ?'; params.push(mapel_id); }

    sql += ' ORDER BY a.tanggal DESC';

    const [rows] = await pool.query(sql, params);

    // Hitung ringkasan
    const ringkasan = { H: 0, I: 0, S: 0, A: 0 };
    rows.forEach(r => { ringkasan[r.status] = (ringkasan[r.status] || 0) + 1; });
    const totalHari = rows.length;
    const persentaseHadir = totalHari > 0
      ? ((ringkasan.H / totalHari) * 100).toFixed(1)
      : '0.0';

    return sendSuccess(res, {
      absensi: rows,
      ringkasan,
      total_hari: totalHari,
      persentase_hadir: `${persentaseHadir}%`,
    });
  } catch (err) {
    console.error('getAbsensiBySiswa error:', err);
    return sendError(res, 'Gagal mengambil data absensi.', 500);
  }
};

/**
 * POST /api/v1/absensi/bulk
 * Body: { kelas_id, mapel_id, tanggal, data: [{ siswa_id, status, keterangan }] }
 * Guru input absensi satu kelas sekaligus (bulk insert).
 */
const inputAbsensiBulk = async (req, res) => {
  const { kelas_id, mapel_id, tanggal, data } = req.body;

  if (!Array.isArray(data) || data.length === 0) {
    return sendError(res, 'Data absensi tidak boleh kosong.', 400);
  }

  try {
    // Ambil guru_id
    let guru_id;
    if (req.user.role === 'guru') {
      const [gp] = await pool.query(
        'SELECT id FROM guru_profile WHERE user_id = ?', [req.user.id]
      );
      if (gp.length === 0) return sendError(res, 'Profil guru tidak ditemukan.', 404);
      guru_id = gp[0].id;
    } else {
      guru_id = req.body.guru_id;
      if (!guru_id) return sendError(res, 'guru_id diperlukan untuk admin.', 400);
    }

    // Siapkan values untuk bulk insert
    const values = data.map(d => [
      d.siswa_id, kelas_id, mapel_id || null, guru_id,
      tanggal, d.status || 'H', d.keterangan || null
    ]);

    // INSERT ... ON DUPLICATE KEY UPDATE (jika sudah ada, update statusnya)
    await pool.query(
      `INSERT INTO absensi (siswa_id, kelas_id, mapel_id, guru_id, tanggal, status, keterangan)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         status     = VALUES(status),
         keterangan = VALUES(keterangan),
         guru_id    = VALUES(guru_id)`,
      [values]
    );

    return sendSuccess(res, { total_diproses: data.length }, 'Absensi berhasil disimpan', 201);
  } catch (err) {
    console.error('inputAbsensiBulk error:', err);
    return sendError(res, 'Gagal menyimpan absensi.', 500);
  }
};

/**
 * PUT /api/v1/absensi/:id
 * Body: { status, keterangan }
 * Koreksi satu entri absensi.
 */
const updateAbsensi = async (req, res) => {
  const { id } = req.params;
  const { status, keterangan } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE absensi SET status = ?, keterangan = ? WHERE id = ?',
      [status, keterangan || null, id]
    );

    if (result.affectedRows === 0) return sendError(res, 'Data absensi tidak ditemukan.', 404);
    return sendSuccess(res, null, 'Absensi berhasil diperbarui');
  } catch (err) {
    console.error('updateAbsensi error:', err);
    return sendError(res, 'Gagal memperbarui absensi.', 500);
  }
};

/**
 * GET /api/v1/absensi/rekap-kelas/:kelasId
 * Rekap absensi seluruh siswa dalam satu kelas (untuk guru/admin).
 * Query: bulan, tahun
 */
const getRekapKelas = async (req, res) => {
  const { kelasId } = req.params;
  const { bulan, tahun } = req.query;

  try {
    let sql = `
      SELECT
        sp.id AS siswa_profile_id,
        u.nama_lengkap,
        sp.nis,
        SUM(CASE WHEN a.status = 'H' THEN 1 ELSE 0 END) AS hadir,
        SUM(CASE WHEN a.status = 'I' THEN 1 ELSE 0 END) AS izin,
        SUM(CASE WHEN a.status = 'S' THEN 1 ELSE 0 END) AS sakit,
        SUM(CASE WHEN a.status = 'A' THEN 1 ELSE 0 END) AS alpa,
        COUNT(a.id) AS total_pertemuan
      FROM siswa_profile sp
      JOIN users u ON u.id = sp.user_id
      LEFT JOIN absensi a ON a.siswa_id = sp.id`;

    const params = [];
    const conditions = ['sp.kelas_id = ?'];
    params.push(kelasId);

    if (bulan && tahun) {
      conditions.push('MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?');
      params.push(bulan, tahun);
    }

    sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' GROUP BY sp.id, u.nama_lengkap, sp.nis ORDER BY u.nama_lengkap ASC';

    const [rows] = await pool.query(sql, params);
    return sendSuccess(res, rows);
  } catch (err) {
    console.error('getRekapKelas error:', err);
    return sendError(res, 'Gagal mengambil rekap absensi kelas.', 500);
  }
};

module.exports = { getAbsensiBySiswa, inputAbsensiBulk, updateAbsensi, getRekapKelas };
