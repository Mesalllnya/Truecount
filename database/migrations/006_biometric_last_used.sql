-- =============================================================
-- TrueCount - Add last_used_at to biometric_credentials
-- Migration: 006_biometric_last_used.sql
-- =============================================================

USE `truecount_db`;

ALTER TABLE `biometric_credentials`
ADD COLUMN `last_used_at` DATETIME NULL AFTER `created_at`;