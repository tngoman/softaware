<?php

namespace App\Client;

/**
 * AI Client API
 * 
 * This API lives on the AI Server (IP: 75.119.141.98).
 * The AI talks to this client API locally, which then securely forwards the requests
 * to the main PHP API (ApiAi.php) using IP whitelisting and a daily rolling token.
 */
class AiClient
{
    private $targetApiUrl;
    private $secretKey;

    public function __construct()
    {
        // One of the following:
        // 1. Public Domain: https://portal.silulumanzi.com/api/ai/
        // 2. Internal VPN IP: http://10.0.6.12/api/ai/
        $this->targetApiUrl = 'https://portal.silulumanzi.com/api/ai/'; 
        
        // This must match the secret key in ApiAi.php exactly
        $this->secretKey = 'SILULUMANZI_AI_SHARED_SECRET_KEY_2026';
        
        // Set CORS headers so the local AI can call this API
        header('Content-Type: application/json');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }

    /**
     * Generate the daily rolling authentication token
     * Uses UTC date to ensure both servers agree on the day regardless of local timezones
     */
    private function generateAuthToken()
    {
        return hash('sha256', $this->secretKey . gmdate('Y-m-d'));
    }

    /**
     * Forward the request to the PHP API securely
     */
    private function forwardRequest($endpoint, $payload)
    {
        $url = rtrim($this->targetApiUrl, '/') . '/' . ltrim($endpoint, '/');
        $token = $this->generateAuthToken();

        $ch = curl_init($url);
        
        $jsonPayload = json_encode($payload);
        
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        
        // Inject the rolling token into the headers
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($jsonPayload),
            'X-AI-Auth-Token: ' . $token
        ]);
        
        // In production, ensure SSL verification is enabled if using HTTPS
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);

        if ($error) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Connection to PHP API failed: ' . $error]);
            exit;
        }

        // Pass the exact HTTP code and response back to the AI
        http_response_code($httpCode);
        echo $response;
        exit;
    }

    /**
     * Handle incoming requests from the local AI
     */
    public function handleRequest()
    {
        // Determine the endpoint the AI wants to call (e.g., ?action=getCustomerContext)
        $action = $_GET['action'] ?? '';
        
        $payload = json_decode(file_get_contents("php://input"), true) ?: [];

        // Map of allowed AI actions to PHP API endpoints
        $validActions = [
            'getCustomerContext',
            'checkAreaOutages',
            'reportFault',
            'getFaultStatus',
            'getFinancials',
            'getStatements',
            'addCustomerNote',
            'getMaintenanceActivities',
            'getStatementLink',
            'getVacancies'
        ];

        if (!in_array($action, $validActions)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid action specified']);
            exit;
        }

        // Forward the request to the PHP API
        $this->forwardRequest($action, $payload);
    }
}

// If this file is accessed directly, handle the request
if (basename(__FILE__) == basename($_SERVER["SCRIPT_FILENAME"])) {
    $client = new AiClient();
    $client->handleRequest();
}
