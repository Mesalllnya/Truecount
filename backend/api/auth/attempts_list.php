<?php

/**
 * GET /auth/attempts/list
 *
 * List authentication attempts (admin only).
 *
 * Query params:
 *   ?page=1&limit=50&user_id=123&method=webauthn&success=0&date_from=2024-01-01
 *
 * Headers:
 *   Authorization: Bearer <admin token>
 *
 * Response 200:
 *   {
 *     "attempts": [{ id, user_id, identifier, method, success, error, ip_address, user_agent, created_at }],
 *     "pagination": { page, limit, total, total_pages }
 *   }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/datetime.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

$db = getDB();

// ── Query params ────────────────────────────────────────────
$page      = max(1, (int)($_GET['page']      ?? 1));
$limit     = min(100, max(1, (int)($_GET['limit']     ?? 50)));
$userId    = $_GET['user_id']    ?? null;
$method    = $_GET['method']     ?? null;
$success   = isset($_GET['success']) ? (int)$_GET['success'] : null;
$dateFrom  = $_GET['date_from']  ?? null;
$dateTo    = $_GET['date_to']    ?? null;
$identifier = $_GET['identifier'] ?? null;

$where   = [];
$params  = [];

if ($userId) {
    $where[] = 'aa.user_id = ?';
    $params[] = $userId;
}
if ($method) {
    $where[] = 'aa.method = ?';
    $params[] = $method;
}
if ($success !== null) {
    $where[] = 'aa.success = ?';
    $params[] = $success;
}
if ($dateFrom) {
    $where[] = 'aa.created_at >= ?';
    $params[] = $dateFrom;
}
if ($dateTo) {
    $where[] = 'aa.created_at <= ?';
    $params[] = $dateTo;
}
if ($identifier) {
    $where[] = 'aa.identifier LIKE ?';
    $params[] = "%{$identifier}%";
}

$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// ── Total count ───────────────────────────────────────────
$countStmt = $db->prepare("SELECT COUNT(*) FROM auth_attempts aa $whereSql");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

// ── Paginated results ─────────────────────────────────────
$offset = ($page - 1) * $limit;
$sql = "
    SELECT
        aa.id,
        aa.user_id,
        aa.identifier,
        aa.method,
        aa.success,
        aa.error,
        aa.ip_address,
        aa.user_agent,
        aa.photo_path,
        aa.created_at,
        u.username,
        u.email,
        u.role
    FROM auth_attempts aa
    LEFT JOIN users u ON aa.user_id = u.id
    $whereSql
    ORDER BY aa.created_at DESC
    LIMIT ? OFFSET ?
";

$params[] = $limit;
$params[] = $offset;

$stmt = $db->prepare($sql);
$stmt->execute($params);
$attempts = $stmt->fetchAll();

jsonResponse([
    'attempts' => array_map(function ($a) {
        return [
            'id'           => (int)$a['id'],
            'user_id'      => $a['user_id'] ? (int)$a['user_id'] : null,
            'identifier'   => $a['identifier'],
            'method'       => $a['method'],
            'success'      => (bool)$a['success'],
            'error'        => $a['error'],
            'ip_address'   => $a['ip_address'],
            'user_agent'   => $a['user_agent'],
            'photo_path'   => $a['photo_path'],
            'created_at'   => toIso8601($a['created_at']),
            'user'         => $a['username'] ? [
                'username' => $a['username'],
                'email'    => $a['email'],
                'role'     => $a['role'],
            ] : null,
        ];
    }, $attempts),
    'pagination' => [
        'page'       => $page,
        'limit'     => $limit,
        'total'     => $total,
        'total_pages' => (int)ceil($total / $limit),
    ],
]);