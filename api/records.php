<?php
// FinMS — generic record endpoint.
//
// Mirrors the IndexedDB operations the frontend already uses, so assets/js/db.js
// keeps the same interface and every page in app.js works unchanged:
//
//   GET    ?store=transactions                          -> getAll
//   GET    ?store=transactions&id=tx1                   -> get
//   GET    ?store=transactions&index=account_id&value=x -> getByIndex
//   POST   ?store=transactions   (JSON body)            -> put (upsert)
//   DELETE ?store=transactions&id=tx1                   -> delete
//   DELETE ?store=transactions&all=1                    -> clear

declare(strict_types=1);
require __DIR__ . '/config.php';

require_login();

$store  = known_store($_GET['store'] ?? null);
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($store === SETTINGS_STORE) {
        handle_settings($method);
    }
    handle_records($store, $method);
} catch (PDOException $e) {
    fail('Database error: ' . $e->getMessage(), 500);
}

function handle_records(string $store, string $method): void
{
    $columns = STORES[$store];
    $pdo     = db();

    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM `{$store}` WHERE id = ?");
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            json_out($row ? cast_row($store, $row) : null);
        }

        if (isset($_GET['index'])) {
            $index = $_GET['index'];
            if (!in_array($index, $columns, true)) fail("Kolom tidak dikenal: {$index}");
            $stmt = $pdo->prepare("SELECT * FROM `{$store}` WHERE `{$index}` = ?");
            $stmt->execute([$_GET['value'] ?? null]);
            json_out(array_map(fn($r) => cast_row($store, $r), $stmt->fetchAll()));
        }

        $rows = $pdo->query("SELECT * FROM `{$store}`")->fetchAll();
        json_out(array_map(fn($r) => cast_row($store, $r), $rows));
    }

    if ($method === 'POST') {
        $record = body();
        if (!isset($record['id']) || $record['id'] === '') fail('Record wajib punya id.');

        // The Pengguna page still posts whatever was typed into the password
        // field. Hash it here so plaintext can never reach the column, whatever
        // the client sends; an existing hash is passed through untouched.
        if ($store === 'users' && isset($record['password']) && $record['password'] !== '') {
            $info = password_get_info($record['password']);
            if (($info['algo'] ?? null) === null || $info['algo'] === 0) {
                $record['password'] = password_hash($record['password'], PASSWORD_DEFAULT);
            }
        }

        // Only whitelisted columns survive; anything else the client sends is dropped.
        $fields = array_values(array_filter($columns, fn($c) => array_key_exists($c, $record)));
        if (!$fields) fail('Tidak ada kolom yang bisa disimpan.');

        $values = [];
        foreach ($fields as $f) {
            $v = $record[$f];
            if (is_bool($v)) $v = $v ? 1 : 0;
            if ($v === '') $v = null;
            $values[] = $v;
        }

        $cols        = implode(', ', array_map(fn($f) => "`{$f}`", $fields));
        $placeholders = implode(', ', array_fill(0, count($fields), '?'));
        $updates     = implode(', ', array_map(fn($f) => "`{$f}` = VALUES(`{$f}`)", $fields));

        $stmt = $pdo->prepare("INSERT INTO `{$store}` ({$cols}) VALUES ({$placeholders}) ON DUPLICATE KEY UPDATE {$updates}");
        $stmt->execute($values);

        json_out(['ok' => true, 'id' => $record['id']]);
    }

    if ($method === 'DELETE') {
        if (isset($_GET['all'])) {
            $pdo->exec("DELETE FROM `{$store}`");
            json_out(['ok' => true, 'cleared' => $store]);
        }
        if (!isset($_GET['id'])) fail('Parameter id wajib diisi.');
        $stmt = $pdo->prepare("DELETE FROM `{$store}` WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        json_out(['ok' => true]);
    }

    fail('Method tidak didukung.', 405);
}

// settings rows have no fixed shape, so the whole record is kept as JSON and
// rebuilt on read — `key` is lifted out to serve as the primary key.
function handle_settings(string $method): void
{
    $pdo = db();

    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare('SELECT `data` FROM `settings` WHERE `key` = ?');
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            json_out($row ? json_decode($row['data'], true) : null);
        }
        $rows = $pdo->query('SELECT `data` FROM `settings`')->fetchAll();
        json_out(array_map(fn($r) => json_decode($r['data'], true), $rows));
    }

    if ($method === 'POST') {
        $record = body();
        if (!isset($record['key']) || $record['key'] === '') fail('Setting wajib punya key.');
        $stmt = $pdo->prepare('INSERT INTO `settings` (`key`, `data`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `data` = VALUES(`data`)');
        $stmt->execute([$record['key'], json_encode($record, JSON_UNESCAPED_UNICODE)]);
        json_out(['ok' => true, 'id' => $record['key']]);
    }

    if ($method === 'DELETE') {
        if (isset($_GET['all'])) {
            $pdo->exec('DELETE FROM `settings`');
            json_out(['ok' => true, 'cleared' => 'settings']);
        }
        if (!isset($_GET['id'])) fail('Parameter id wajib diisi.');
        $stmt = $pdo->prepare('DELETE FROM `settings` WHERE `key` = ?');
        $stmt->execute([$_GET['id']]);
        json_out(['ok' => true]);
    }

    fail('Method tidak didukung.', 405);
}
