-- Migration: Add photo_path column to auth_attempts table
-- Stores camera photo path for each authentication attempt (success or failure)

ALTER TABLE `auth_attempts`
ADD COLUMN `photo_path` VARCHAR(255) NULL AFTER `user_agent`;
