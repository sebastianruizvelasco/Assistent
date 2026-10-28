<?php
// Proxy de IA de AURA para producción en hosting PHP (InfinityFree).
// Equivale a api/assistant.ts, que se usa solo en desarrollo (npm run dev).
// El navegador lo llama como POST /api/assistant (el .htaccess lo redirige aquí).
// No guarda ninguna clave: usa la que el usuario escribe en el panel del asistente.

const AURA_SYSTEM_PROMPT = 'Eres AURA, un asistente de calendario en español. Responde de forma breve y útil. Puedes sugerir cambios, pero no inventes eventos ni confirmes cambios que el usuario no haya pedido.';
const AURA_MAX_MESSAGES = 60;
const AURA_MAX_CONTENT = 40000;
const AURA_MAX_BODY = 400000;

function aura_respond($status, $payload)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function aura_upstream_error($data)
{
    if (is_array($data) && isset($data['error'])) {
        $error = $data['error'];
        if (is_string($error)) {
            return $error;
        }
        if (is_array($error) && isset($error['message']) && is_string($error['message'])) {
            return $error['message'];
        }
    }
    return 'El proveedor de IA no devolvió una respuesta válida.';
}

// Límite por IP: 30 peticiones por minuto. Sin esto, un script puede usar el proxy como relay
// con su propia clave y consumir los recursos del hosting.
function aura_rate_limited($limit = 30, $window = 60)
{
    $dir = sys_get_temp_dir() . '/aura-ratelimit';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return false; // sin sitio para contar, no se bloquea a nadie
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'desconocida';
    $file = $dir . '/' . sha1($ip) . '.json';
    $now = time();
    $data = is_file($file) ? json_decode((string) @file_get_contents($file), true) : null;
    if (!is_array($data) || !isset($data['start'], $data['count']) || ($now - (int) $data['start']) > $window) {
        $data = ['start' => $now, 'count' => 0];
    }
    $data['count'] = (int) $data['count'] + 1;
    @file_put_contents($file, json_encode($data), LOCK_EX);
    return $data['count'] > $limit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    aura_respond(405, ['error' => 'Método no permitido.']);
}

// Solo acepta llamadas desde la propia web: evita que otros sitios usen este endpoint.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== '' && strcasecmp((string) parse_url($origin, PHP_URL_HOST), preg_replace('/:\d+$/', '', $host)) !== 0) {
    aura_respond(403, ['error' => 'Origen no permitido.']);
}

if (aura_rate_limited()) {
    header('Retry-After: 60');
    aura_respond(429, ['error' => 'Demasiadas peticiones seguidas. Espera un minuto e inténtalo de nuevo.']);
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > AURA_MAX_BODY) {
    aura_respond(413, ['error' => 'La solicitud es demasiado grande.']);
}
$body = json_decode($raw, true);
if (!is_array($body)) {
    aura_respond(400, ['error' => 'La solicitud no es un JSON válido.']);
}

$defaults = [
    'openrouter' => 'openai/gpt-6.1-sol',
    'openai' => 'gpt-6-luna',
    'gemini' => 'gemini-3.8-flash',
    'anthropic' => 'claude-haiku-5-5',
];
$provider = strtolower(is_string($body['provider'] ?? null) ? $body['provider'] : 'openrouter');
if (!isset($defaults[$provider])) {
    $provider = 'openrouter';
}

$apiKey = is_string($body['apiKey'] ?? null) ? trim($body['apiKey']) : '';
if ($apiKey === '') {
    aura_respond(503, ['error' => 'Falta configurar la clave API de ' . strtoupper($provider) . ' en el panel del asistente.']);
}

$model = is_string($body['model'] ?? null) ? trim($body['model']) : '';
if ($model === '') {
    $model = $defaults[$provider];
}
if (strlen($model) > 200 || !preg_match('/^[\w.:\/-]+$/', $model)) {
    aura_respond(400, ['error' => 'El nombre del modelo no es válido.']);
}

$messages = [];
if (is_array($body['messages'] ?? null)) {
    foreach (array_slice($body['messages'], -AURA_MAX_MESSAGES) as $message) {
        if (is_array($message) && is_string($message['role'] ?? null) && is_string($message['content'] ?? null)) {
            $messages[] = [
                'role' => $message['role'] === 'assistant' ? 'assistant' : 'user',
                'content' => mb_substr($message['content'], 0, AURA_MAX_CONTENT),
            ];
        }
    }
}

$headers = ['Content-Type: application/json'];
if ($provider === 'openrouter' || $provider === 'openai') {
    $url = $provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    $headers[] = 'Authorization: Bearer ' . $apiKey;
    if ($provider === 'openrouter') {
        $headers[] = 'HTTP-Referer: ' . ($origin !== '' ? $origin : 'https://' . $host);
        $headers[] = 'X-Title: AURA Assistant';
    }
    $payload = [
        'model' => $model,
        'messages' => array_merge([['role' => 'system', 'content' => AURA_SYSTEM_PROMPT]], $messages),
    ];
    if ($provider === 'openai') {
        // Los modelos razonadores de OpenAI rechazan temperature y max_tokens.
        $payload['max_completion_tokens'] = 800;
    } else {
        $payload['temperature'] = 0.3;
        $payload['max_tokens'] = 800;
    }
} elseif ($provider === 'anthropic') {
    $url = 'https://api.anthropic.com/v1/messages';
    $headers[] = 'x-api-key: ' . $apiKey;
    $headers[] = 'anthropic-version: 2023-06-01';
    $payload = ['model' => $model, 'max_tokens' => 800, 'system' => AURA_SYSTEM_PROMPT, 'messages' => $messages];
} else {
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
    $headers[] = 'x-goog-api-key: ' . $apiKey;
    $contents = [];
    foreach ($messages as $message) {
        $contents[] = ['role' => $message['role'] === 'assistant' ? 'model' : 'user', 'parts' => [['text' => $message['content']]]];
    }
    $payload = [
        'system_instruction' => ['parts' => [['text' => AURA_SYSTEM_PROMPT]]],
        'contents' => count($contents) ? $contents : [['role' => 'user', 'parts' => [['text' => 'Hola']]]],
    ];
}

if (!function_exists('curl_init')) {
    aura_respond(500, ['error' => 'Este servidor no tiene cURL habilitado.']);
}

$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 40,
]);
$result = curl_exec($curl);
$errno = curl_errno($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($result === false) {
    aura_respond($errno === 28 ? 504 : 502, ['error' => $errno === 28 ? 'El proveedor de IA tardó demasiado en responder.' : 'No pude conectar con el proveedor de IA.']);
}

$data = json_decode($result, true);
if (!is_array($data)) {
    $data = [];
}
if ($status < 200 || $status >= 300 || isset($data['error'])) {
    aura_respond($status === 401 || $status === 403 ? 401 : 502, ['error' => aura_upstream_error($data)]);
}

if ($provider === 'anthropic') {
    $reply = $data['content'][0]['text'] ?? '';
} elseif ($provider === 'gemini') {
    $reply = '';
    foreach ($data['candidates'][0]['content']['parts'] ?? [] as $part) {
        $reply .= $part['text'] ?? '';
    }
} else {
    $reply = $data['choices'][0]['message']['content'] ?? '';
}

if (!is_string($reply) || $reply === '') {
    aura_respond(502, ['error' => 'No pude obtener una respuesta del proveedor de IA.']);
}
aura_respond(200, ['reply' => $reply]);
