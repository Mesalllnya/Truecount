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
require_once __DIR__ . '/../../helpers/election_scheduler.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();
$isAdmin  = ($authUser['role'] ?? '') === 'admin';

$db = getDB();
syncElectionStatuses($db);

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

if ($isAdmin) {
    $stmt = $db->prepare(
        "SELECT e.id, e.title, e.description, e.start_time, e.end_time,
                e.status, e.created_by, e.created_at,
                COUNT(DISTINCT c.id) AS candidate_count,
                COUNT(DISTINCT v.id) AS voter_count
           FROM elections e
           LEFT JOIN candidates c ON c.election_id = e.id
           LEFT JOIN voters v ON v.election_id = e.id
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
        'voter_count'     => (int)($r['voter_count'] ?? 0),
        'is_registered'   => true,
        'has_voted'       => false,
    ], $rows);
} else {
    // Untuk voter: ambil status registrasi dan apakah sudah memilih, serta paslon
    $voterId = (int)$authUser['sub'];
    $stmt = $db->prepare(
        "SELECT e.id, e.title, e.description, e.start_time, e.end_time,
                e.status, e.created_by, e.created_at,
                COUNT(DISTINCT c.id) AS candidate_count,
                v.id AS voter_record_id,
                v.has_voted
           FROM elections e
           LEFT JOIN candidates c ON c.election_id = e.id
           LEFT JOIN voters v ON v.election_id = e.id AND v.user_id = ?
         $where
         GROUP BY e.id
         ORDER BY e.created_at DESC"
    );
    $stmt->execute(array_merge([$voterId], $params));
    $rows = $stmt->fetchAll();

    // Ambil semua candidates untuk elections yang dimuat jika query param ?with_candidates=1
    $withCandidates = isset($_GET['with_candidates']) && $_GET['with_candidates'] === '1';
    $candidatesMap = [];

    if ($withCandidates && !empty($rows)) {
        $eIds = array_map(fn($r) => (int)$r['id'], $rows);
        $placeholders = implode(',', array_fill(0, count($eIds), '?'));
        $stmtC = $db->prepare(
            "SELECT id, election_id, name, vision, mission, photo_path, photo_file_id
               FROM candidates
              WHERE election_id IN ($placeholders)
              ORDER BY id ASC"
        );
        $stmtC->execute($eIds);
        $cRows = $stmtC->fetchAll();
        foreach ($cRows as $cr) {
            $eid = (int)$cr['election_id'];
            if (!isset($candidatesMap[$eid])) {
                $candidatesMap[$eid] = [];
            }
            $candidatesMap[$eid][] = [
                'id'            => (int)$cr['id'],
                'name'          => $cr['name'],
                'vision'        => $cr['vision'],
                'mission'       => $cr['mission'],
                'photo_path'    => $cr['photo_path'],
                'photo_file_id' => $cr['photo_file_id'] !== null ? (int)$cr['photo_file_id'] : null,
            ];
        }
    }

    $elections = array_map(function($r) use ($withCandidates, $candidatesMap) {
        $eid = (int)$r['id'];
        $item = [
            'id'              => $eid,
            'title'           => $r['title'],
            'description'     => $r['description'],
            'start_time'      => toIso8601($r['start_time']),
            'end_time'        => toIso8601($r['end_time']),
            'status'          => $r['status'],
            'created_by'      => (int)$r['created_by'],
            'created_at'      => toIso8601($r['created_at']),
            'candidate_count' => (int)$r['candidate_count'],
            'is_registered'   => $r['voter_record_id'] !== null,
            'has_voted'       => (bool)($r['has_voted'] ?? false),
        ];
        if ($withCandidates) {
            $item['candidates'] = $candidatesMap[$eid] ?? [];
        }
        return $item;
    }, $rows);
}

jsonResponse(['elections' => $elections]);
exit;
