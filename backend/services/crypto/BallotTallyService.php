
<?php

require_once __DIR__ . '/AESGCMService.php';
require_once __DIR__ . '/../../config/database.php';

class BallotTallyService
{
    public static function calculateResults(int $electionId): array
    {
        if ($electionId <= 0) {
            throw new InvalidArgumentException(
                'Election ID tidak valid.'
            );
        }

        $db = getDB();

        // Hanya izinkan penghitungan setelah election ditutup.
        $stmt = $db->prepare(
            "SELECT id, status
             FROM elections
             WHERE id = :id
             LIMIT 1"
        );

        $stmt->execute([':id' => $electionId]);
        $election = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$election) {
            throw new RuntimeException(
                'Pemilihan tidak ditemukan.'
            );
        }

        if ($election['status'] !== 'closed') {
            throw new RuntimeException(
                'Penghitungan hanya dapat dilakukan setelah pemilihan ditutup.'
            );
        }

        // Ambil kandidat untuk pemilihan tersebut.
        $stmt = $db->prepare(
            "SELECT id, name
             FROM candidates
             WHERE election_id = :election_id
             ORDER BY id ASC"
        );

        $stmt->execute([':election_id' => $electionId]);
        $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $results = [];

        foreach ($candidates as $candidate) {
            $results[(int) $candidate['id']] = [
                'candidate_id' => (int) $candidate['id'],
                'candidate_name' => $candidate['name'],
                'vote_count' => 0
            ];
        }

        // Ambil ciphertext ballot.
        $stmt = $db->prepare(
            "SELECT encrypted_vote, nonce, auth_tag, integrity_hash
             FROM ballots
             WHERE election_id = :election_id"
        );

        $stmt->execute([':election_id' => $electionId]);
        $ballots = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalVotes = 0;

        foreach ($ballots as $ballot) {

            // Verifikasi hash tambahan.
            $calculatedHash = hash(
                'sha256',
                $ballot['encrypted_vote'] .
                $ballot['nonce'] .
                $ballot['auth_tag']
            );

            if (!hash_equals(
                $ballot['integrity_hash'],
                $calculatedHash
            )) {
                throw new RuntimeException(
                    'Integritas ballot gagal diverifikasi.'
                );
            }

            // Dekripsi dan verifikasi AES-GCM.
            $plaintext = AESGCMService::decrypt(
                $ballot['encrypted_vote'],
                $ballot['nonce'],
                $ballot['auth_tag']
            );

            $vote = json_decode(
                $plaintext,
                true,
                512,
                JSON_THROW_ON_ERROR
            );

            if (
                !isset($vote['election_id'], $vote['candidate_id']) ||
                (int) $vote['election_id'] !== $electionId
            ) {
                throw new RuntimeException(
                    'Payload ballot tidak valid.'
                );
            }

            $candidateId = (int) $vote['candidate_id'];

            if (!isset($results[$candidateId])) {
                throw new RuntimeException(
                    'Ballot mengandung kandidat yang tidak valid.'
                );
            }

            $results[$candidateId]['vote_count']++;
            $totalVotes++;
        }

        return [
            'election_id' => $electionId,
            'total_votes' => $totalVotes,
            'results' => array_values($results)
        ];
    }
}
