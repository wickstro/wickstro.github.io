<?php
// Unsubscribe link at the end of every newsletter: unsubscribe.php?e=<email>&t=<token>.
// Opening the link only shows a button; the address is removed when the button is pressed.
// (Some mail programs and virus scanners open links by themselves, and that must not
// unsubscribe anyone.)

declare(strict_types=1);
require __DIR__ . '/lib.php';

header('X-Robots-Tag: noindex');

$email = strtolower(trim((string) ($_REQUEST['e'] ?? '')));
$token = (string) ($_REQUEST['t'] ?? '');
$row = nl_read_list()[$email] ?? null;
$valid = $row !== null && $token !== '' && hash_equals($row['token'], $token);
$lang = $row['lang'] ?? (($_GET['l'] ?? '') === 'fi' ? 'fi' : 'sv');
$fi = $lang === 'fi';

if (!$valid) {
    http_response_code(404);
    nl_page($lang, $fi ? 'Linkki ei toimi' : 'Länken fungerar inte',
        $fi ? '<p>Tätä tilausta ei löytynyt. Jos haluat perua uutiskirjeen, vastaa mihin tahansa uutiskirjeeseen tai lähetä viesti osoitteeseen <a href="mailto:lotta.hardman@gmail.com">lotta.hardman@gmail.com</a>.</p>'
            : '<p>Prenumerationen hittades inte. Om du vill avsluta nyhetsbrevet kan du svara på vilket nyhetsbrev som helst eller skicka e-post till <a href="mailto:lotta.hardman@gmail.com">lotta.hardman@gmail.com</a>.</p>');
    exit;
}

$address = htmlspecialchars($email);

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    try {
        nl_update_list(function (array &$rows) use ($email): bool {
            if ($rows[$email]['status'] === 'unsubscribed') {
                return false;
            }
            $rows[$email]['status'] = 'unsubscribed';
            $rows[$email]['updated'] = gmdate('Y-m-d H:i:s');
            return true;
        });
    } catch (Throwable $e) {
        error_log('newsletter unsubscribe: ' . $e->getMessage());
        http_response_code(500);
        nl_page($lang, $fi ? 'Jotain meni pieleen' : 'Något gick fel',
            $fi ? '<p>Yritä hetken päästä uudelleen tai lähetä viesti osoitteeseen <a href="mailto:lotta.hardman@gmail.com">lotta.hardman@gmail.com</a>.</p>'
                : '<p>Försök igen om en stund eller skicka e-post till <a href="mailto:lotta.hardman@gmail.com">lotta.hardman@gmail.com</a>.</p>');
        exit;
    }
    nl_page($lang, $fi ? 'Tilaus peruttu' : 'Prenumerationen avslutad',
        $fi ? "<p>Osoitteeseen <strong>$address</strong> ei enää lähetetä Dr Hardmanin uutiskirjettä. Kiitos, kun olit mukana!</p>"
            : "<p>Dr Hardmans nyhetsbrev skickas inte längre till <strong>$address</strong>. Tack för att du var med!</p>");
    exit;
}

$action = htmlspecialchars('unsubscribe.php?e=' . rawurlencode($email) . '&t=' . rawurlencode($token));
nl_page($lang, $fi ? 'Peru uutiskirje' : 'Avsluta nyhetsbrevet',
    ($fi ? "<p>Haluatko lopettaa Dr Hardmanin uutiskirjeen tilauksen osoitteeseen <strong>$address</strong>?</p>"
        : "<p>Vill du sluta få Dr Hardmans nyhetsbrev till <strong>$address</strong>?</p>")
    . '<form method="post" action="' . $action . '"><button type="submit">'
    . ($fi ? 'Kyllä, peru tilaus' : 'Ja, avsluta prenumerationen') . '</button></form>');
