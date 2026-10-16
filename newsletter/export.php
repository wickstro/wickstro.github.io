<?php
// Current subscribers as CSV (email, lang, unsubscribe_url) for the Google Sheet that sends
// the newsletter: export.php?key=<export_key from config.php>. Without a valid key it is a 404.

declare(strict_types=1);
require __DIR__ . '/lib.php';

header('X-Robots-Tag: noindex');

$key = (string) (nl_config()['export_key'] ?? '');
if (strlen($key) < 20 || !hash_equals($key, (string) ($_GET['key'] ?? ''))) {
    http_response_code(404);
    exit;
}

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="drhardman-newsletter.csv"');
header('Cache-Control: no-store');

$out = fopen('php://output', 'w');
fputcsv($out, ['email', 'lang', 'unsubscribe_url'], ',', '"', '');
foreach (nl_read_list() as $row) {
    if ($row['status'] === 'active') {
        fputcsv($out, [$row['email'], $row['lang'], nl_unsubscribe_url($row)], ',', '"', '');
    }
}
fclose($out);
