-- =============================================================
-- TrueCount - Add phone & address columns to users table
-- Migration: 015
-- Description: Add optional profile fields for user profile page
-- =============================================================

USE `truecount_db`;

-- Add optional profile columns to users table
ALTER TABLE `users`
    ADD COLUMN `phone` VARCHAR(20) NULL AFTER `email`,
    ADD COLUMN `address` TEXT NULL AFTER `phone`;