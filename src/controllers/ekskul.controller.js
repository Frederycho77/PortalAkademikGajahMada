/**
 * src/controllers/ekskul.controller.js
 * ---------------------------------------------------------------
 * Pengelolaan Ekstrakurikuler dan Pendaftaran Siswa.
 *
 * FITUR UTAMA:
 *   1. List ekskul dengan info kuota sisa
 *   2. Detail satu ekskul
 *   3. CRUD ekskul (admin)
 *   4. Pendaftaran ekskul oleh siswa — dengan pengecekan kuota
 *      menggunakan DATABASE TRANSACTION agar atomik (thread-safe)
 *   5. Manajemen status pendaftaran oleh admin/guru pembina
 *
 * Hak akses:
 *   GET  ekskul          : semua role
 *   POST ekskul          : admin
 *   PUT/DELETE ekskul    : admin
 *   POST pendaftaran     : siswa
 *   PUT status daftar    : admin, guru
 *   GET  daftar saya     : siswa (melihat status pendaftarannya)
 * ---------------------------------------------------------------
 */

'use strict';

const { pool }     = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

// ================================================================
// SECTION 1: MANAJEMEN DATA EKSTRAKURIKULER
// ================================================================

/**
 * GET /api/v1/ekskul
 * Menampilkan semua ekskul aktif beserta info kuota tersisa.
 * Query: search, tersedia (true/false = hanya yang masih ada kuota)
 */
const getAllEkskul = async (req, res) => {
  const { search, tersedia } = req.query;

  try {
    let sql = `
      SELECT
        e.id,
        e.nama_ekskul,
        e.deskripsi,
        e.jadwal,
        e.tempat,
        e.kuota_max,
        e.kuota_terisi,
        (e.kuota_max - e.kuota_terisi) AS kuota_sisa,
        e.biaya,
        e.foto,
        e.is_active,
        u.nama_lengkap AS nama_pembina
      FROM ekstrakurikuler e
      LEFT JOIN users u ON u.id = e.pembina_id
      WHERE e.is_active = 1`;

    const params = [];

    if (search) {
      sql += ' AND (e.nama_ekskul LIKE ? OR e.deskripsi LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Filter hanya ekskul yang masih ada kuota kosong
    if (tersedia === 'true') {
      sql += ' AND e.kuota_terisi < e.kuota_max';
    }

    sql += ' ORDER BY e.nama_ekskul ASC';

    const [rows] = await pool.query(sql, params);
    return sendSuccess(res, rows);
  } catch (err) {
    console.error('getAllEkskul error:', err);
    return sendError(res, 'Gagal mengambil data ekstrakurikuler.', 500);
  }
};

/** GET /api/v1/ekskul/:id — detail satu ekskul */
const getEkskulById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         e.*,
         (e.kuota_max - e.kuota_terisi) AS kuota_sisa,
         u.nama_lengkap AS nama_pembina
       FROM ekstrakurikuler e
       LEFT JOIN users u ON u.id = e.pembina_id
       WHERE e.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) return sendError(res, 'Ekstrakurikuler tidak ditemukan.', 404);
    return sendSuccess(res, rows[0]);
  } catch (err) {
    console.error('getEkskulById error:', err);
    return sendError(res, 'Gagal mengambil data ekskul.', 500);
  }
};

/** POST /api/v1/ekskul — buat ekskul baru (admin) */
const createEkskul = async (req, res) => {
  const { nama_ekskul, deskripsi, pembina_id, jadwal, tempat, kuota_max, biaya } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO ekstrakurikuler
         (nama_ekskul, deskripsi, pembina_id, jadwal, tempat, kuota_max, biaya)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nama_ekskul, deskripsi || null, pembina_id || null,
       jadwal, tempat || null, kuota_max || 30, biaya || 0]
    );
    return sendSuccess(res, { id: result.insertId }, 'Ekstrakurikuler berhasil dibuat', 201);
  } catch (err) {
    console.error('createEkskul error:', err);
    return sendError(res, 'Gagal membuat ekskul.', 500);
  }
};

/** PUT /api/v1/ekskul/:id — update ekskul (admin) */
const updateEkskul = async (req, res) => {
  const { id } = req.params;
  const { nama_ekskul, deskripsi, pembina_id, jadwal, tempat, kuota_max, biaya, is_active } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE ekstrakurikuler
       SET nama_ekskul = ?, deskripsi = ?, pembina_id = ?,
           jadwal = ?, tempat = ?, kuota_max = ?, biaya = ?, is_active = ?
       WHERE id = ?`,
      [nama_ekskul, deskripsi || null, pembina_id || null,
       jadwal, tempat || null, kuota_max, biaya || 0, is_active ?? 1, id]
    );
    if (result.affectedRows === 0) return sendError(res, 'Ekskul tidak ditemukan.', 404);
    return sendSuccess(res, null, 'Ekskul berhasil diperbarui');
  } catch (err) {
    console.error('updateEkskul error:', err);
    return sendError(res, 'Gagal memperbarui ekskul.', 500);
  }
};

/** DELETE /api/v1/ekskul/:id — soft delete (admin) */
const deleteEkskul = async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE ekstrakurikuler SET is_active = 0 WHERE id = ?', [req.params.id]
    );
    if (result.affectedRows === 0) return sendError(res, 'Ekskul tidak ditemukan.', 404);
    return sendSuccess(res, null, 'Ekskul berhasil dinonaktifkan');
  } catch (err) {
    console.error('deleteEkskul error:', err);
    return sendError(res, 'Gagal menghapus ekskul.', 500);
  }
};

// ================================================================
// SECTION 2: PENDAFTARAN EKSTRAKURIKULER
// ================================================================

/**
 * POST /api/v1/ekskul/daftar
 * ---------------------------------------------------------------
 * INTI FITUR: Pendaftaran ekskul oleh siswa dengan pengecekan kuota.
 *
 * Alur Logika (menggunakan DB TRANSACTION untuk keamanan):
 *
 *   Step 1 → Mulai transaction
 *   Step 2 → LOCK baris ekskul dengan SELECT ... FOR UPDATE
 *            (mencegah race condition jika 2 siswa daftar bersamaan)
 *   Step 3 → Cek kuota_terisi < kuota_max
 *            → Jika PENUH: rollback, kirim error 409
 *   Step 4 → Cek apakah siswa sudah pernah daftar ekskul ini
 *            → Jika SUDAH: rollback, kirim error 409
 *   Step 5 → INSERT ke pendaftaran_ekskul (status = 'pending')
 *   Step 6 → Commit transaction
 *   Step 7 → Response sukses
 *
 * NOTE: Trigger di database (trg_ekskul_kuota_tambah) akan
 *       otomatis menambah kuota_terisi saat status diubah
 *       menjadi 'diterima' oleh admin/guru.
 * ---------------------------------------------------------------
 * Body: { ekskul_id }
 */
const daftarEkskul = async (req, res) => {
  const { ekskul_id } = req.body;

  // Ambil profil siswa dari user yang login
  let connection;
  try {
    // ── Step 1: Dapatkan koneksi dari pool untuk transaction ──
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // ── Step 2: Ambil profil siswa ──────────────────────────────
    const [siswaRows] = await connection.query(
      'SELECT id FROM siswa_profile WHERE user_id = ?',
      [req.user.id]
    );

    if (siswaRows.length === 0) {
      await connection.rollback();
      connection.release();
      return sendError(res, 'Profil siswa tidak ditemukan. Hubungi administrator.', 404);
    }

    const siswa_id = siswaRows[0].id;

    // ── Step 3: LOCK baris ekskul (SELECT FOR UPDATE) ───────────
    // Kunci ini mencegah dua request masuk secara bersamaan sama-sama
    // lolos pengecekan kuota, yang akan menyebabkan over-quota.
    const [ekskulRows] = await connection.query(
      `SELECT id, nama_ekskul, kuota_max, kuota_terisi, is_active
       FROM ekstrakurikuler
       WHERE id = ?
       FOR UPDATE`,
      [ekskul_id]
    );

    if (ekskulRows.length === 0) {
      await connection.rollback();
      connection.release();
      return sendError(res, 'Ekstrakurikuler tidak ditemukan.', 404);
    }

    const ekskul = ekskulRows[0];

    // Cek apakah ekskul masih aktif
    if (!ekskul.is_active) {
      await connection.rollback();
      connection.release();
      return sendError(res, 'Ekstrakurikuler ini sudah tidak aktif.', 400);
    }

    // ── Step 4: PENGECEKAN KUOTA ────────────────────────────────
    const kuotaSisa = ekskul.kuota_max - ekskul.kuota_terisi;

    if (kuotaSisa <= 0) {
      await connection.rollback();
      connection.release();
      return sendError(
        res,
        `Maaf, kuota untuk ekskul "${ekskul.nama_ekskul}" sudah penuh ` +
        `(${ekskul.kuota_terisi}/${ekskul.kuota_max} peserta).`,
        409  // 409 Conflict
      );
    }

    // ── Step 5: Cek apakah siswa sudah mendaftar ekskul ini ─────
    const [existingRows] = await connection.query(
      `SELECT id, status FROM pendaftaran_ekskul
       WHERE siswa_id = ? AND ekskul_id = ?`,
      [siswa_id, ekskul_id]
    );

    if (existingRows.length > 0) {
      const statusSebelumnya = existingRows[0].status;
      await connection.rollback();
      connection.release();
      return sendError(
        res,
        `Anda sudah pernah mendaftar ekskul ini. Status pendaftaran: "${statusSebelumnya}".`,
        409
      );
    }

    // ── Step 6: INSERT pendaftaran ──────────────────────────────
    // Status awal = 'pending', menunggu persetujuan admin/guru
    const [insertResult] = await connection.query(
      `INSERT INTO pendaftaran_ekskul (siswa_id, ekskul_id, status)
       VALUES (?, ?, 'pending')`,
      [siswa_id, ekskul_id]
    );

    // ── Step 7: Commit ──────────────────────────────────────────
    await connection.commit();
    connection.release();

    return sendSuccess(
      res,
      {
        pendaftaran_id: insertResult.insertId,
        ekskul: ekskul.nama_ekskul,
        status: 'pending',
        kuota_sisa_setelah: kuotaSisa - 0, // kuota_terisi baru naik setelah 'diterima'
        pesan: 'Pendaftaran Anda sedang menunggu persetujuan dari pembina/admin.',
      },
      'Pendaftaran ekskul berhasil dikirim',
      201
    );

  } catch (err) {
    // Rollback jika ada error apapun di tengah transaction
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('daftarEkskul error:', err);
    return sendError(res, 'Gagal mendaftar ekskul. Silakan coba lagi.', 500);
  }
};

/**
 * GET /api/v1/ekskul/pendaftaran/saya
 * Siswa melihat status semua pendaftaran ekskul miliknya.
 */
const getPendaftaranSaya = async (req, res) => {
  try {
    const [sp] = await pool.query(
      'SELECT id FROM siswa_profile WHERE user_id = ?', [req.user.id]
    );
    if (sp.length === 0) return sendError(res, 'Profil siswa tidak ditemukan.', 404);

    const [rows] = await pool.query(
      `SELECT
         pd.id,
         pd.tanggal_daftar,
         pd.status,
         pd.alasan_penolakan,
         e.nama_ekskul,
         e.jadwal,
         e.tempat,
         e.foto,
         u.nama_lengkap AS nama_pembina
       FROM pendaftaran_ekskul pd
       JOIN ekstrakurikuler e ON e.id = pd.ekskul_id
       LEFT JOIN users u ON u.id = e.pembina_id
       WHERE pd.siswa_id = ?
       ORDER BY pd.tanggal_daftar DESC`,
      [sp[0].id]
    );

    return sendSuccess(res, rows);
  } catch (err) {
    console.error('getPendaftaranSaya error:', err);
    return sendError(res, 'Gagal mengambil data pendaftaran.', 500);
  }
};

/**
 * GET /api/v1/ekskul/:ekskulId/peserta
 * Melihat daftar peserta yang mendaftar ekskul tertentu.
 * Hanya admin & guru pembina.
 */
const getPesertaEkskul = async (req, res) => {
  const { ekskulId } = req.params;
  const { status } = req.query;

  try {
    let sql = `
      SELECT
        pd.id AS pendaftaran_id,
        pd.tanggal_daftar,
        pd.status,
        pd.alasan_penolakan,
        sp.nis,
        u.nama_lengkap,
        k.nama_kelas
      FROM pendaftaran_ekskul pd
      JOIN siswa_profile sp ON sp.id = pd.siswa_id
      JOIN users u ON u.id = sp.user_id
      JOIN kelas k ON k.id = sp.kelas_id
      WHERE pd.ekskul_id = ?`;

    const params = [ekskulId];
    if (status) { sql += ' AND pd.status = ?'; params.push(status); }
    sql += ' ORDER BY pd.tanggal_daftar ASC';

    const [rows] = await pool.query(sql, params);
    return sendSuccess(res, rows);
  } catch (err) {
    console.error('getPesertaEkskul error:', err);
    return sendError(res, 'Gagal mengambil data peserta.', 500);
  }
};

/**
 * PATCH /api/v1/ekskul/pendaftaran/:pendaftaranId/status
 * Admin/guru mengubah status pendaftaran: 'diterima' atau 'ditolak'.
 * Trigger di DB akan otomatis update kuota_terisi saat status = 'diterima'.
 *
 * Body: { status: 'diterima' | 'ditolak', alasan_penolakan? }
 */
const updateStatusPendaftaran = async (req, res) => {
  const { pendaftaranId } = req.params;
  const { status, alasan_penolakan } = req.body;

  if (!['diterima', 'ditolak'].includes(status)) {
    return sendError(res, 'Status harus "diterima" atau "ditolak".', 400);
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Ambil data pendaftaran saat ini
    const [pd] = await connection.query(
      `SELECT pd.*, e.kuota_max, e.kuota_terisi
       FROM pendaftaran_ekskul pd
       JOIN ekstrakurikuler e ON e.id = pd.ekskul_id
       WHERE pd.id = ?
       FOR UPDATE`,
      [pendaftaranId]
    );

    if (pd.length === 0) {
      await connection.rollback();
      connection.release();
      return sendError(res, 'Data pendaftaran tidak ditemukan.', 404);
    }

    const pendaftaran = pd[0];

    // Jika ingin menerima, cek ulang kuota (untuk jaga-jaga)
    if (status === 'diterima' && pendaftaran.status !== 'diterima') {
      const kuotaSisa = pendaftaran.kuota_max - pendaftaran.kuota_terisi;
      if (kuotaSisa <= 0) {
        await connection.rollback();
        connection.release();
        return sendError(res, 'Kuota ekskul sudah penuh. Tidak dapat menerima pendaftaran ini.', 409);
      }
    }

    // Update status pendaftaran
    // Trigger trg_ekskul_kuota_tambah akan otomatis
    // menambah/mengurangi kuota_terisi di tabel ekstrakurikuler
    await connection.query(
      `UPDATE pendaftaran_ekskul
       SET status = ?, alasan_penolakan = ?
       WHERE id = ?`,
      [status, alasan_penolakan || null, pendaftaranId]
    );

    await connection.commit();
    connection.release();

    const pesanStatus = status === 'diterima' ? 'diterima' : 'ditolak';
    return sendSuccess(res, { status }, `Pendaftaran berhasil ${pesanStatus}`);

  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('updateStatusPendaftaran error:', err);
    return sendError(res, 'Gagal memperbarui status pendaftaran.', 500);
  }
};

/**
 * DELETE /api/v1/ekskul/pendaftaran/:pendaftaranId/batal
 * Siswa membatalkan pendaftaran yang masih 'pending'.
 */
const batalPendaftaran = async (req, res) => {
  const { pendaftaranId } = req.params;

  try {
    const [sp] = await pool.query(
      'SELECT id FROM siswa_profile WHERE user_id = ?', [req.user.id]
    );
    if (sp.length === 0) return sendError(res, 'Profil siswa tidak ditemukan.', 404);

    // Pastikan hanya bisa batalkan pendaftaran milik sendiri yang masih pending
    const [pd] = await pool.query(
      `SELECT id, status FROM pendaftaran_ekskul
       WHERE id = ? AND siswa_id = ?`,
      [pendaftaranId, sp[0].id]
    );

    if (pd.length === 0) return sendError(res, 'Data pendaftaran tidak ditemukan.', 404);

    if (pd[0].status !== 'pending') {
      return sendError(
        res,
        `Pendaftaran yang sudah "${pd[0].status}" tidak dapat dibatalkan. Hubungi admin.`,
        400
      );
    }

    await pool.query('DELETE FROM pendaftaran_ekskul WHERE id = ?', [pendaftaranId]);
    return sendSuccess(res, null, 'Pendaftaran berhasil dibatalkan');
  } catch (err) {
    console.error('batalPendaftaran error:', err);
    return sendError(res, 'Gagal membatalkan pendaftaran.', 500);
  }
};

module.exports = {
  getAllEkskul,
  getEkskulById,
  createEkskul,
  updateEkskul,
  deleteEkskul,
  daftarEkskul,
  getPendaftaranSaya,
  getPesertaEkskul,
  updateStatusPendaftaran,
  batalPendaftaran,
};
