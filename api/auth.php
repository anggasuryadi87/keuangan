<?php
// FinMS — server-side authentication.
//
//   POST ?action=login   {email, password}  -> sets the session
//   POST ?action=logout                     -> clears it
//   GET  ?action=me                         -> current user, or null
//
// The password never leaves the server in a response, and login is verified
// against a password_hash() digest instead of the plaintext comparison the
// IndexedDB version did in the browser.

declare(strict_types=1);
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'login':  do_login();  break;
        case 'logout': do_logout(); break;
        case 'me':     do_me();     break;
        default:       fail('Action tidak dikenal.', 404);
    }
} catch (PDOException $e) {
    fail('Database error: ' . $e->getMessage(), 500);
}

function public_user(array $row): array
{
    unset($row['password']);
    $row['active'] = (bool) $row['active'];
    return $row;
}

function do_login(): void
{
    $in       = body();
    $email    = trim((string) ($in['email'] ?? ''));
    $password = (string) ($in['password'] ?? '');

    if ($email === '' || $password === '') fail('Email dan password wajib diisi.');

    $stmt = db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // One message for both cases, so the response cannot be used to discover
    // which email addresses exist.
    if (!$user || !password_verify($password, $user['password'])) {
        fail('Email atau password salah.', 401);
    }
    if (!$user['active']) fail('Akun ini tidak aktif.', 403);

    start_session();
    session_regenerate_id(true);
    $_SESSION['finms_user'] = public_user($user);

    json_out($_SESSION['finms_user']);
}

function do_logout(): void
{
    start_session();
    $_SESSION = [];
    session_destroy();
    json_out(['ok' => true]);
}

function do_me(): void
{
    $user = current_user();
    if ($user === null) json_out(null);

    // Re-read so a deactivated or deleted account cannot keep an open session.
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();

    if (!$row || !$row['active']) {
        start_session();
        $_SESSION = [];
        session_destroy();
        json_out(null);
    }

    json_out(public_user($row));
}
