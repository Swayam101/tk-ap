<?php

/**
 * API Key Configuration
 *
 * To use the API, you need to set up your public and secret API keys.
 * Visit https://moonito.net/api for more details.
 *
 * @var string $apiPublicKey Your API Public Key
 * @var string $apiSecretKey Your API Secret Key
 */

$apiPublicKey = 'FItqHGSAlZmvcMJPr4hSZosbRiwMJOAS'; // Enter your API Public Key here
$apiSecretKey = 'Oi7cOv6g9fCtIipmQLRBevF48wSFpgZMIrMvXFu68zs4c2otzWqu3jVxf0SoUqxZ'; // Enter your API Secret Key here

/**
 * Site Protection Settings
 *
 * Control site protection and handle unwanted visitors.
 * You can enable/disable protection and choose how to handle unwanted visitors.
 * 
 * @var boolean $isProtected Turns protection on (true) or off (false)
 * @var string|integer $unwantedVisitorTo The URL or HTTP error code for unwanted visitors
 * @var integer $unwantedVisitorAction Determines how the unwanted visitors will see the page
 *      1 = Redirection
 *      2 = Iframe
 *      3 = Load content from another site or file
 */

$isProtected = true; // Enable protection (true) or disable it (false)
$unwantedVisitorTo = 'https://google.com'; // URL to redirect unwanted visitors or HTTP error code (e.g., https://example.com or 404)
$unwantedVisitorAction = 1; // How to handle unwanted visitors: 1 = Redirect, 2 = Show in an iframe, 3 = Load content