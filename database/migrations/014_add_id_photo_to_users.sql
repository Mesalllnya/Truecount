-- =============================================================
-- TrueCount - Add ID Photo fields to users table
-- Migration: 014
-- Description: Add id_photo_path and id_photo_type columns for KTP/SIM verification
-- =============================================================

USE `truecount_db`;

-- Add ID photo columns to users table
ALTER TABLE `users`
    ADD COLUMN `id_photo_path` VARCHAR(255) NULL AFTER `password_hash`,
    ADD COLUMN `id_photo_type` ENUM('ktp','sim') NULL AFTER `id_photo_path`;