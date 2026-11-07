-- Migration 002: Add AES-GCM Authentication Tag

ALTER TABLE encrypted_messages
ADD COLUMN auth_tag VARCHAR(64) NULL;

ALTER TABLE ballots
ADD COLUMN auth_tag VARCHAR(64) NULL;
