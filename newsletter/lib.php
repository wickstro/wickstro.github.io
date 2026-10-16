<?php
// Shared helpers for the newsletter scripts (subscribe.php, unsubscribe.php, export.php).
//
// The list and the settings live OUTSIDE the web root, because every deploy runs
// rsync --delete and would wipe anything inside it. Folder: drhardman-newsletter/ next to the
// site folder (/var/www/production/drhardman-newsletter/) if it exists, otherwise
// /home/lotta/drhardman-newsletter/, or the folder in the NEWSLETTER_DATA_DIR environment
// variable (used for local testing). Apache must be able to write there. The folder holds:
//   subscribers.csv  the list (created on the first signup)
//   config.php       <?php return ['export_key' => 'long random string'];

declare(strict_types=1);

const NL_HOME = 'https://drhardman.fi';

// Pages allowed to send people here; they are sent back to the same site afterwards
const NL_ALLOWED_ORIGINS = [
    'https://drhardman.fi',
    'https://www.drhardman.fi',
    'https://wickstro.github.io',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://0.0.0.0:4000',
];

const NL_COLUMNS = ['email', 'lang', 'status', 'token', 'subscribed', 'updated'];

function nl_data_dir(): string
{
    if ($dir = getenv('NEWSLETTER_DATA_DIR')) {
        return rtrim($dir, '/');
    }
    // Next to the site folder if it could be made there, otherwise in the owner's home folder
    $nextToSite = dirname(__DIR__, 2) . '/drhardman-newsletter';
    return is_dir($nextToSite) ? $nextToSite : '/home/lotta/drhardman-newsletter';
}

function nl_config(): array
{
    $file = nl_data_dir() . '/config.php';
    return is_file($file) ? (array) require $file : [];
}

function nl_valid_email(string $email): bool
{
    // A leading = + - @ would turn into a formula when the list is opened in a spreadsheet
    return strlen($email) <= 254
        && filter_var($email, FILTER_VALIDATE_EMAIL) !== false
        && !preg_match('/^[=+\-@]/', $email);
}

function nl_unsubscribe_url(array $row): string
{
    return NL_HOME . '/newsletter/unsubscribe.php?e=' . rawurlencode($row['email']) . '&t=' . $row['token'];
}

/**
 * Runs $fn(array &$rows) on the whole list (rows keyed by email) while holding an exclusive
 * lock, and writes the list back if $fn returns true.
 */
function nl_update_list(callable $fn): void
{
    $fh = fopen(nl_data_dir() . '/subscribers.csv', 'c+');
    if ($fh === false) {
        throw new RuntimeException('cannot open subscribers.csv in ' . nl_data_dir());
    }
    try {
        flock($fh, LOCK_EX);
        $rows = nl_read_rows($fh);
        $changed = $fn($rows);
        // Privacy notice (dataskydd/tietosuoja): unsubscribed addresses are kept one year, then deleted
        $cutoff = gmdate('Y-m-d H:i:s', time() - 365 * 86400);
        foreach ($rows as $email => $row) {
            if ($row['status'] === 'unsubscribed' && $row['updated'] < $cutoff) {
                unset($rows[$email]);
                $changed = true;
            }
        }
        if ($changed) {
            ftruncate($fh, 0);
            rewind($fh);
            fputcsv($fh, NL_COLUMNS, ',', '"', '');
            foreach ($rows as $row) {
                fputcsv($fh, array_values($row), ',', '"', '');
            }
            fflush($fh);
        }
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

/** Reads the list without changing it (shared lock). */
function nl_read_list(): array
{
    $fh = @fopen(nl_data_dir() . '/subscribers.csv', 'r');
    if ($fh === false) {
        return [];
    }
    flock($fh, LOCK_SH);
    $rows = nl_read_rows($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $rows;
}

/** @param resource $fh */
function nl_read_rows($fh): array
{
    $rows = [];
    rewind($fh);
    fgetcsv($fh, null, ',', '"', ''); // header
    while (($r = fgetcsv($fh, null, ',', '"', '')) !== false) {
        if (count($r) === count(NL_COLUMNS)) {
            $row = array_combine(NL_COLUMNS, $r);
            $rows[$row['email']] = $row;
        }
    }
    return $rows;
}

/** Simple page in the site's colours, for unsubscribe.php. */
function nl_page(string $lang, string $title, string $body): void
{
    header('Content-Type: text/html; charset=utf-8');
    $home = NL_HOME . ($lang === 'fi' ? '/fi/' : '/');
    $back = $lang === 'fi' ? 'Dr Hardmanin etusivulle' : 'Till Dr Hardmans startsida';
    echo '<!DOCTYPE html><html lang="' . $lang . '"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex"><title>' . htmlspecialchars($title) . ' – Dr Hardman</title>'
        // Same fonts and heading style as the site (_includes/head.html, _sass/_typography.scss)
        . '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        . '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Source+Sans+3:wght@300..700&display=swap">'
        . '<style>body{margin:0;background:#131314;color:#c6c4c1;font:300 1.2rem/1.4 "Source Sans 3","Segoe UI",Helvetica,Arial,sans-serif}'
        . 'main{max-width:36rem;margin:0 auto;padding:4rem 2rem}'
        . 'h1{margin:0 0 1rem;padding-bottom:1rem;border-bottom:1px solid #e0c09f;font:400 3rem/1.1 "Bebas Neue","Arial Narrow",sans-serif;letter-spacing:4px;text-transform:uppercase;color:#fff}'
        . 'a{color:#fff}'
        . 'button{font:inherit;font-weight:400;min-height:48px;padding:0 1.5em;border:0;border-radius:12px;background:#e0c09f;color:#131314;cursor:pointer}'
        . 'button:hover,button:focus{background:#ecd2b6}</style></head><body><main>'
        . '<h1>' . htmlspecialchars($title) . '</h1>' . $body
        . '<p><a href="' . $home . '">' . $back . ' →</a></p></main></body></html>';
}
