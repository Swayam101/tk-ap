<?php

error_reporting(0);
ini_set('display_errors', 0);

include_once(__DIR__ . '/config.php');

if ($isProtected === true) {
  // Client IP Address Retrieval
  if (isset($_SERVER["HTTP_CF_CONNECTING_IP"])) {
    $_SERVER['REMOTE_ADDR'] = $_SERVER["HTTP_CF_CONNECTING_IP"];
    $_SERVER['HTTP_CLIENT_IP'] = $_SERVER["HTTP_CF_CONNECTING_IP"];
  }

  $clientIp = filter_var($_SERVER['HTTP_CLIENT_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'], FILTER_VALIDATE_IP) ?? '';

  // Analytics API Request
  $agent = urlencode($_SERVER['HTTP_USER_AGENT']);
  $domain = strtolower($_SERVER['HTTP_HOST']);
  $events = urlencode($_SERVER['REQUEST_URI']);

  // Initialize cURL session
  $curl = curl_init();

  // Set cURL options
  curl_setopt_array($curl, [
    CURLOPT_URL => 'https://moonito.net/api/v1/analytics?' . http_build_query([
        'ip' => $clientIp,
        'ua' => $agent,
        'events' => $events,
        'domain' => $domain,
      ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => '',
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 0,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => 'GET',
    CURLOPT_HTTPHEADER => [
      'User-Agent: Mozilla/5.0 (Linux; Android 13; SM-G991U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
      'X-Public-Key: ' . $apiPublicKey,
      'X-Secret-Key: ' . $apiSecretKey,
    ],
  ]);

  // Execute cURL request
  $response = curl_exec($curl);

  // Close cURL session
  curl_close($curl);

  // Decode JSON response
  $response = json_decode($response, true);

  // Process $response as needed
  if ($response['data']['status']['need_to_block'] ?? false) {
    // Options
    $options = ['ssl' => ['verify_peer' => FALSE, 'verify_peer_name' => FALSE], 'http' => ['header' => 'User-Agent: ' . $_SERVER['HTTP_USER_AGENT']]];

    // Unwanted visitor page
    if (!empty($unwantedVisitorTo)) {
      // Handle HTTP response
      if(is_numeric($unwantedVisitorTo)) {
        http_response_code((int)$unwantedVisitorTo);
        exit();
      }

      // Handle iframe
      if($unwantedVisitorAction === 2) {
        echo '<iframe src="' . $unwantedVisitorTo . '" width="100%" height="100%" align="left"></iframe> <style> body { padding: 0; margin: 0; } iframe { margin: 0; padding: 0; border: 0; } </style>';
        exit();
      }

      // Handle load content
      if($unwantedVisitorAction === 3) {
        if (filter_var($unwantedVisitorTo, FILTER_VALIDATE_URL)) {
            echo str_replace('<head>', '<head><base href="' . $unwantedVisitorTo . '" />', file_get_contents($unwantedVisitorTo, FALSE, stream_context_create($options)));
            exit();
        } elseif (file_exists($unwantedVisitorTo)) {
            if (pathinfo($unwantedVisitorTo, PATHINFO_EXTENSION) == 'php') {
              require_once($unwantedVisitorTo);
            } else {
              echo file_get_contents($unwantedVisitorTo, FALSE, stream_context_create($options));
            }
            exit();
        } else {
          exit('Unwanted Visitor Page Not Found.');
        }
      }

      // Handle redirection
      header("Expires: Mon, 23 Jul 1993 05:00:00 GMT");
      header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
      header("Cache-Control: no-store, no-cache, must-revalidate");
      header("Cache-Control: post-check=0, pre-check=0", false);
      header("Pragma: no-cache");
      header('Location: ' . $unwantedVisitorTo, TRUE, 302);
      exit();
    }

    header('HTTP/1.0 403 Forbidden');
    header("Expires: Mon, 23 Jul 1993 05:00:00 GMT");
    header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
    header("Cache-Control: no-store, no-cache, must-revalidate");
    header("Cache-Control: post-check=0, pre-check=0", false);
    header("Pragma: no-cache");
    echo <<<EOF
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
    <meta name="robots" content="noindex,follow,noarchive">
    <style>
        .sep { border-bottom: 5px black dotted; }
    </style>
</head>
<body bgcolor="#EEEEEE" text="#000000" link="#CC0000" vlink="#CC0000" alink="#CC0000">
    <table border="0" cellspacing="0" cellpadding="0" width="70%" align="center">
        <tr>
            <td valign="top">
                <div align="center"><img src="https://media.giphy.com/media/cmxpKrPjyygfsK0jhj/giphy.gif" border="0" alt="" width="200" height="200"></div><br><br>
                <table border="0" cellspacing="1" cellpadding="1" width="100%" bgcolor="#FF0000">
                    <tr>
                        <td bgcolor="#FFFFFF" style="padding:2px 2px 10px 10px;">
                            <br>
                            <b>Access Denied!</b><br><br>
                            Oops! It seems like you've encountered our website security measures. Your access has been blocked for security reasons.<br>
                            If you believe this is an error or have any concerns, please contact our support team for assistance.<br><br>
                            Thank you for your understanding.<br><br>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
EOF;
    exit();
  }
}
