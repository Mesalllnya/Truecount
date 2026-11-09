<?php

/**
 * GET /elections - Daftar semua pemilihan
 *
 * - Voter  : hanya melihat election yang status = active / closed
 * - Admin  : melihat semua election (termasuk draft)
 *
 * Query params:
 *   ?status=draft|active|closed   (opsional, filter)
 *
 * Response 200:
 *   { "elections": [ { id, title, description, start_time, end_time,
 *                       status, created_by, created_at, candidate_count } ] }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/datetime.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();
$isAdmin  = ($authUser['role'] ?? '') === 'admin';

$db = getDB();

// ── Filter status ──────────────────────────────────────────
$statusFilter  = $_GET['status'] ?? null;
$allowedStatus = ['draft', 'active', 'closed'];

$conditions = [];
$params     = [];

if ($statusFilter !== null) {
    if (!in_array($statusFilter, $allowedStatus, true)) {
        jsonResponse(['error' => 'Status tidak valid. Gunakan draft, active, atau closed.'], 422);
    }
    $conditions[] = 'e.status = ?';
    $params[]     = $statusFilter;
} elseif (!$isAdmin) {
    // Voter hanya lihat active & closed
    $conditions[] = 'e.status IN ("active","closed")';
}

$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

$stmt = $db->prepare(
    "SELECT e.id, e.title, e.description, e.start_time, e.end_time,
            e.status, e.created_by, e.created_at,
            COUNT(c.id) AS candidate_count
       FROM elections e
       LEFT JOIN candidates c ON c.election_id = e.id
     $where
     GROUP BY e.id
     ORDER BY e.created_at DESC"
);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$elections = array_map(fn($r) => [
    'id'              => (int)$r['id'],
    'title'           => $r['title'],
    'description'     => $r['description'],
    'start_time'      => toIso8601($r['start_time']),
    'end_time'        => toIso8601($r['end_time']),
    'status'          => $r['status'],
    'created_by'      => (int)$r['created_by'],
    'created_at'      => toIso8601($r['created_at']),
    'candidate_count' => (int)$r['candidate_count'],
], $rows);

jsonResponse(['elections' => $elections]);
