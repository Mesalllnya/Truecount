<?php

require_once __DIR__ .
    '/backend/config/database.php';

require_once __DIR__ .
    '/backend/services/crypto/BlockchainService.php';

$db = getDB();

$electionId = 1;

echo "=== BLOCKCHAIN TAMPERING TEST ===\n\n";

try {
    $db->beginTransaction();

    // Ambil block terakhir.
    $stmt = $db->prepare(
        "SELECT id, data
        FROM blocks
        WHERE election_id = :id
        ORDER BY block_index DESC
        LIMIT 1"
    );

    $stmt->execute([':id' => $electionId]);
    $block = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$block) {
        throw new RuntimeException(
            'Block tidak ditemukan.'
        );
    }

    // Ubah isi block.
    $tamperedData = $block['data'] .
        ' TAMPERED';

    $stmt = $db->prepare(
        "UPDATE blocks
        SET data = :data
        WHERE id = :id"
    );

    $stmt->execute([
        ':data' => $tamperedData,
        ':id' => $block['id']
    ]);

    echo "Block berhasil dimodifikasi.\n";

    // Verifikasi harus gagal.
    $result = BlockchainService::verifyChain(
        $electionId
    );

    if ($result['valid'] === false) {
        echo "PASS: Tampering berhasil dideteksi!\n";
        echo "Pesan: " . $result['message'] . "\n";
    } else {
        echo "FAIL: Tampering tidak terdeteksi!\n";
    }

} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";

} finally {
    if ($db->inTransaction()) {
        $db->rollBack();
        echo "\nDatabase dikembalikan ke kondisi semula.\n";
    }
}

echo "\n=== TEST SELESAI ===\n";
