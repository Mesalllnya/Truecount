-- =============================================================
-- TrueCount - Add storage_dir column to encrypted_files table
-- Migration: 016
-- Description: Simpan subfolder penyimpanan file terenkripsi di
--              bawah storage/private/ (mis. 'candidate-photos'
--              untuk foto paslon, 'encrypted-files' untuk lainnya)
--              supaya foto paslon terpisah dari file lain.
-- =============================================================

USE `truecount_db`;

-- MySQL 8 tidak mendukung `ADD COLUMN IF NOT EXISTS` (sintaks MariaDB),
-- jadi kolom dicek dulu lewat information_schema (pola sama dengan 011).
SET @ddl = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'encrypted_files'
       AND COLUMN_NAME = 'storage_dir') = 0,
    'ALTER TABLE `encrypted_files` ADD COLUMN `storage_dir` VARCHAR(64) NOT NULL DEFAULT ''encrypted-files'' AFTER `stored_path`',
    'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
