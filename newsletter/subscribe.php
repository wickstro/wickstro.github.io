<?php
// Newsletter signup: the form in _includes/newsletter-form.html posts here. Adds the address
// to the list (or turns a cancelled subscription back on) and sends the visitor back to the
// page they came from, with ?nl=ok|invalid|error for the message under the form.

declare(strict_types=1);
require __DIR__ . '/lib.php';

$lang = ($_POST['lang'] ?? '') === 'fi' ? 'fi' : 'sv';

// Back to the same site and page; anything unexpected goes to the front page
$origin = NL_HOME;
$referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');
foreach (NL_ALLOWED_ORIGINS as $allowed) {
    if ($referer === $allowed || str_starts_with($referer, $allowed . '/')) {
        $origin = $allowed;
    }
}
$path = (string) ($_POST['back'] ?? '');
if (!preg_match('~^/[A-Za-z0-9/_.\-]*$~', $path) || str_contains($path, '//')) {
    $path = $lang === 'fi' ? '/fi/' : '/';
}

function done(string $status): never
{
    global $origin, $path;
    header('Location: ' . $origin . $path . '?nl=' . $status . '#nyhetsbrev', true, 303);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    done('error');
}

// Hidden field that only bots fill in: pretend it worked
if (($_POST['website'] ?? '') !== '') {
    done('ok');
}

$email = strtolower(trim((string) ($_POST['email'] ?? '')));
if (!nl_valid_email($email)) {
    done('invalid');
}

try {
    nl_update_list(function (array &$rows) use ($email, $lang): bool {
        $now = gmdate('Y-m-d H:i:s');
        if (isset($rows[$email])) {
            if ($rows[$email]['status'] === 'active' && $rows[$email]['lang'] === $lang) {
                return false;
            }
            $rows[$email]['status'] = 'active';
            $rows[$email]['lang'] = $lang;
            $rows[$email]['updated'] = $now;
            return true;
        }
        $rows[$email] = [
            'email' => $email,
            'lang' => $lang,
            'status' => 'active',
            'token' => bin2hex(random_bytes(16)),
            'subscribed' => $now,
            'updated' => $now,
        ];
        return true;
    });
} catch (Throwable $e) {
    error_log('newsletter subscribe: ' . $e->getMessage());
    done('error');
}

done('ok');
