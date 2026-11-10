-- =============================================================
-- Migration 009: Add photo_file_id column to candidates table
-- Untuk integrasi enkripsi foto dan steganografi paslon
-- =============================================================

USE `truecount_db`;

ALTER TABLE `candidates`
ADD COLUMN `photo_file_id` INT UNSIGNED NULL AFTER `photo_path`,
ADD CONSTRAINT `fk_candidates_photo_file`
    FOREIGN KEY (`photo_file_id`) REFERENCES `encrypted_files` (`id`)
    ON DELETE SET NULL;

