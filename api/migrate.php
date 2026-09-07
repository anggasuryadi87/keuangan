<?php
// FinMS — one-off import of a backup JSON export into MySQL.
//
// Run from the command line, not the browser:
//   php api/migrate.php "D:\backup-finms\finms-backup-2026-09-07.json"
//
// Safe to re-run: every row is an upsert keyed by id.

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Jalankan lewat command line, bukan browser.\n");
}

require __DIR__ . '/config.php';

$path = $argv[1] ?? '';
if ($path === '' || !is_file($path)) {
    exit("Pemakaian: php api/migrate.php <file-backup.json>\n");
}

$payload = json_decode((string) file_get_contents($path), true);
if (!is_array($payload) || ($payload['format'] ?? '') !== 'finms-backup') {
    exit("File ini bukan backup FinMS.\n");
}

$data = $payload['data'] ?? [];
$pdo  = db();

echo "Sumber : {$path}\n";
echo "Origin : " . ($payload['origin'] ?? '-') . "\n";
echo "Dibuat : " . ($payload['exported_at'] ?? '-') . "\n\n";

$pdo->beginTransaction();
$summary = [];

try {
    foreach (STORES as $store => $columns) {
        $rows = $data[$store] ?? [];
        if (!is_array($rows) || !$rows) { $summary[$store] = 0; continue; }

        $count = 0;
        foreach ($rows as $row) {
            if (!is_array($row) || !isset($row['id'])) continue;

            // Plaintext passwords from the old client-side auth become hashes
            // here. Already-hashed values are left alone so a re-run is safe.
            if ($store === 'users' && isset($row['password'])) {
                $info = password_get_info($row['password']);
                if (($info['algo'] ?? null) === null || $info['algo'] === 0) {
                    $row['password'] = password_hash($row['password'], PASSWORD_DEFAULT);
                }
            }

            $fields = array_values(array_filter($columns, fn($c) => array_key_exists($c, $row)));
            if (!$fields) continue;

            $values = [];
            foreach ($fields as $f) {
                $v = $row[$f];
                if (is_bool($v)) $v = $v ? 1 : 0;
                if ($v === '') $v = null;
                if (is_array($v)) $v = json_encode($v, JSON_UNESCAPED_UNICODE);
                $values[] = $v;
            }

            $cols         = implode(', ', array_map(fn($f) => "`{$f}`", $fields));
            $placeholders = implode(', ', array_fill(0, count($fields), '?'));
            $updates      = implode(', ', array_map(fn($f) => "`{$f}` = VALUES(`{$f}`)", $fields));

            $stmt = $pdo->prepare("INSERT INTO `{$store}` ({$cols}) VALUES ({$placeholders}) ON DUPLICATE KEY UPDATE {$updates}");
            $stmt->execute($values);
            $count++;
        }
        $summary[$store] = $count;
    }

    // settings keeps its whole record as JSON, keyed by `key`.
    $settings = $data[SETTINGS_STORE] ?? [];
    $count = 0;
    foreach ($settings as $row) {
        if (!is_array($row) || !isset($row['key'])) continue;
        $stmt = $pdo->prepare('INSERT INTO `settings` (`key`, `data`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `data` = VALUES(`data`)');
        $stmt->execute([$row['key'], json_encode($row, JSON_UNESCAPED_UNICODE)]);
        $count++;
    }
    $summary['settings'] = $count;

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    exit("GAGAL — tidak ada perubahan yang disimpan.\n" . $e->getMessage() . "\n");
}

$total = 0;
foreach ($summary as $store => $n) {
    printf("  %-18s %d\n", $store, $n);
    $total += $n;
}
echo "\nSelesai. {$total} record masuk ke database `" . DB_NAME . "`.\n";
