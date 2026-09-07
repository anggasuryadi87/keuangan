<?php
// FinMS — database connection, store definitions, shared helpers.

declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_NAME = 'finms';
const DB_USER = 'root';
const DB_PASS = ""; // isi bila MySQL Anda memakai password

// Column whitelist per store. Nothing outside these lists ever reaches SQL, so
// a client cannot name its own columns. Also drives type casting on the way out.
const STORES = [
    'users'            => ['id','name','email','password','role','active','created_at'],
    'categories'       => ['id','name','flow_type','section','color'],
    'accounts'         => ['id','name','bank','account_number','balance','type','color','active'],
    'clients'          => ['id','name','contact','phone','email','address','created_at'],
    'projects'         => ['id','name','client_id','value','status','start_date','end_date','description','created_at'],
    'milestones'       => ['id','project_id','name','percentage','amount','due_date','status','invoice_id'],
    'invoices'         => ['id','number','project_id','milestone_id','client_id','amount','tax','total','issue_date','due_date','status','notes','created_at'],
    'invoice_payments' => ['id','invoice_id','amount','date','account_id','notes','created_at'],
    'expenses'         => ['id','title','category_id','category_type','amount','date','account_id','status','requested_by','approved_by','description','attachment','created_at'],
    'transactions'     => ['id','type','account_id','category_id','amount','date','description','ref_type','ref_id','created_by','created_at','updated_at'],
    'reconciliations'  => ['id','account_id','date','amount','status','notes','created_at'],
];

// Numbers must come back as JSON numbers, not the strings PDO returns for
// DECIMAL — the frontend does arithmetic on them directly.
const NUMERIC_FIELDS = ['balance','amount','value','tax','total','percentage'];
const BOOLEAN_FIELDS = ['active'];

// settings is schemaless and stored as one JSON blob per key.
const SETTINGS_STORE = 'settings';

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    }
    return $pdo;
}

function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): void
{
    json_out(['error' => $message], $status);
}

function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $parsed = json_decode($raw, true);
    return is_array($parsed) ? $parsed : [];
}

function known_store(?string $store): string
{
    if ($store === null || $store === '') fail('Parameter store wajib diisi.');
    if ($store === SETTINGS_STORE) return $store;
    if (!array_key_exists($store, STORES)) fail("Store tidak dikenal: {$store}", 404);
    return $store;
}

// Rows leave MySQL as strings. Restore the shapes the frontend expects so a
// record read back is identical to the one that was written.
function cast_row(string $store, array $row): array
{
    foreach ($row as $key => $value) {
        if ($value === null) continue;
        if (in_array($key, NUMERIC_FIELDS, true)) {
            $row[$key] = 0 + $value;
        } elseif (in_array($key, BOOLEAN_FIELDS, true)) {
            $row[$key] = (bool) $value;
        }
    }
    return $row;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
        session_start();
    }
}

function current_user(): ?array
{
    start_session();
    return $_SESSION['finms_user'] ?? null;
}

function require_login(): array
{
    $user = current_user();
    if ($user === null) fail('Belum login.', 401);
    return $user;
}
