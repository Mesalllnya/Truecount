-- =============================================================
-- Migration 010: Add crypto_version to ballots & encrypted_messages
-- Digunakan untuk menandai versi enkripsi dan autentikasi AAD
-- =============================================================

USE `truecount_db`;

ALTER TABLE `ballots`
ADD COLUMN `crypto_version` TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER `auth_tag`;

ALTER TABLE `encrypted_messages`
ADD COLUMN `crypto_version` TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER `auth_tag`;

