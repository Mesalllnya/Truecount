<?php

/**
 * Application-wide configuration constants.
 * TrueCount — Secure E-Voting System
 */

// Pastikan header CORS sesuai URL frontend yang dipakai.
define('APP_ENV',         $_ENV['APP_ENV']         ?? 'development');
define('FRONTEND_ORIGIN', $_ENV['FRONTEND_ORIGIN'] ?? 'http://localhost:5173');

// JWT / Session
define('JWT_SECRET',  $_ENV['JWT_SECRET']  ?? 'change-this-to-a-strong-random-secret');
define('JWT_EXPIRE',  (int)($_ENV['JWT_EXPIRE']  ?? 3600));   // seconds

// Undangan pendaftaran (invite) — berapa hari sebelum kedaluwarsa
define('INVITE_EXPIRE_DAYS', (int)($_ENV['INVITE_EXPIRE_DAYS'] ?? 7));

// Password hashing (PASSWORD_ARGON2ID — PHP 7.3+)
define('ARGON2_MEMORY_COST', 65536);   // 64 MB
define('ARGON2_TIME_COST',   4);
define('ARGON2_THREADS',     2);
