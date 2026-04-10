<?php if (isset($_GET['link'])) {
	$link = $_GET['link'];
	if (filter_var($link, FILTER_VALIDATE_URL)) {
		header("Referrer-Policy: no-referrer");
		header("Location: $link");
		exit();
	}
}
?>