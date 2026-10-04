/*
  =============================================================================
  GLIDER CONTROL - ESP32 Glider Flight Controller Firmware
  =============================================================================
  Hardware:
    * ESP32 Development Board
    * L293D Motor Driver (or mini L298N / MX1508)
    * Coreless DC Motor (Propulsion)
    * 2x Micro Servos (Elevator & Rudder)
    * Laptop Wi-Fi Hotspot Connection
  
  Endpoints:
    GET /status            -> Returns JSON connection telemetry (RSSI, status, motor PWM)
    GET /motor?speed=VALUE -> Sets motor PWM speed (0 to 255)

  IMPORTANT SAFETY:
    * Remove propeller during bench testing!
    * Built-in 3-second failsafe: If connection is lost while motor is running,
      the motor automatically shuts down (PWM 0).
  =============================================================================
*/

#include <WiFi.h>
#include <WebServer.h>

// -----------------------------------------------------------------------------
// 1. WI-FI HOTSPOT CONFIGURATION
// -----------------------------------------------------------------------------
// Enter your Laptop Hotspot SSID and Password here:
const char* WIFI_SSID     = "MyLaptopHotspot";
const char* WIFI_PASSWORD = "GliderPassword123";

// -----------------------------------------------------------------------------
// 2. HARDWARE PIN DEFINITIONS (L293D & MOTOR)
// -----------------------------------------------------------------------------
// L293D Motor Driver Pinout
const int MOTOR_PWM_PIN = 18;  // L293D EN1 (Speed control via PWM)
const int MOTOR_IN1_PIN = 19;  // L293D IN1 (Direction forward)
const int MOTOR_IN2_PIN = 21;  // L293D IN2 (Direction reverse / GND)

// Built-in status LED
const int LED_PIN = 2;

// PWM Configuration for ESP32 LEDC (Motor Speed)
const int PWM_FREQ       = 20000; // 20kHz quiet frequency for coreless DC motors
const int PWM_CHANNEL    = 0;
const int PWM_RESOLUTION = 8;     // 8-bit resolution (0 to 255)

// -----------------------------------------------------------------------------
// 3. FLIGHT STATE & FAILSAFE
// -----------------------------------------------------------------------------
WebServer server(80);
volatile int currentMotorSpeed = 0;
unsigned long lastHeartbeat = 0;
const unsigned long FAILSAFE_TIMEOUT_MS = 3500; // Auto-stop motor if no packet for 3.5s

// Helper: Attach CORS headers so local browsers on laptop never block requests
void sendCorsHeader() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
}

// -----------------------------------------------------------------------------
// 4. MOTOR CONTROL FUNCTION
// -----------------------------------------------------------------------------
void applyMotorSpeed(int speed) {
  speed = constrain(speed, 0, 255);
  currentMotorSpeed = speed;

  if (speed == 0) {
    // Motor Cut-Off / Coast
    digitalWrite(MOTOR_IN1_PIN, LOW);
    digitalWrite(MOTOR_IN2_PIN, LOW);
    ledcWrite(PWM_CHANNEL, 0);
    digitalWrite(LED_PIN, LOW);
  } else {
    // Forward Drive with PWM Speed
    digitalWrite(MOTOR_IN1_PIN, HIGH);
    digitalWrite(MOTOR_IN2_PIN, LOW);
    ledcWrite(PWM_CHANNEL, speed);
    digitalWrite(LED_PIN, HIGH);
  }
}

// -----------------------------------------------------------------------------
// 5. HTTP REQUEST HANDLERS
// -----------------------------------------------------------------------------

// Handle CORS pre-flight OPTIONS requests
void handleOptions() {
  sendCorsHeader();
  server.send(204);
}

// GET /status
void handleStatus() {
  sendCorsHeader();
  lastHeartbeat = millis();

  long rssi = WiFi.RSSI();
  String json = "{";
  json += "\"status\":\"ok\",";
  json += "\"rssi\":" + String(rssi) + ",";
  json += "\"motor\":" + String(currentMotorSpeed) + ",";
  json += "\"voltage\":\"N/A\",";
  json += "\"uptime_s\":" + String(millis() / 1000);
  json += "}";

  server.send(200, "application/json", json);
}

// GET /motor?speed=VALUE
void handleMotor() {
  sendCorsHeader();
  lastHeartbeat = millis();

  if (server.hasArg("speed")) {
    int speed = server.arg("speed").toInt();
    applyMotorSpeed(speed);

    String response = "{\"status\":\"ok\",\"speed\":" + String(currentMotorSpeed) + "}";
    server.send(200, "application/json", response);
    Serial.printf("[MOTOR] Speed set to: %d (PWM: %d/255)\n", speed, currentMotorSpeed);
  } else {
    server.send(400, "application/json", "{\"error\":\"Missing 'speed' parameter\"}");
  }
}

// Root page
void handleRoot() {
  sendCorsHeader();
  server.send(200, "text/plain", "GLIDER CONTROL ESP32 - READY. Use /status or /motor?speed=0-255");
}

// -----------------------------------------------------------------------------
// 6. SETUP & MAIN LOOP
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=============================================");
  Serial.println("  GLIDER CONTROL - ESP32 FIRMWARE INITIALIZING");
  Serial.println("=============================================");

  // Initialize Hardware Pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(MOTOR_IN1_PIN, OUTPUT);
  pinMode(MOTOR_IN2_PIN, OUTPUT);

  // Configure ESP32 LEDC PWM for Motor Driver
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(MOTOR_PWM_PIN, PWM_CHANNEL);

  // Initial Safe State: Motor Off
  applyMotorSpeed(0);

  // Connect to Laptop Wi-Fi Hotspot
  Serial.print("[WIFI] Connecting to Laptop Hotspot: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA); // Station Mode (Connects to Laptop Hotspot)
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN)); // Flash LED during connect
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("\n[WIFI] Connected to Hotspot Successfully!");
    Serial.print("[WIFI] ESP32 IP Address: http://");
    Serial.println(WiFi.localIP());
    Serial.println(">>> Enter this IP address in the GLIDER CONTROL website Settings! <<<");
  } else {
    digitalWrite(LED_PIN, LOW);
    Serial.println("\n[WIFI] Failed to connect to Hotspot. Check SSID/Password and retry.");
  }

  // Register Web Server Endpoints
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/motor", HTTP_GET, handleMotor);

  // Register OPTIONS for browser CORS support
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/motor", HTTP_OPTIONS, handleOptions);

  server.begin();
  Serial.println("[SERVER] HTTP Web Server started on port 80.");
  lastHeartbeat = millis();
}

void loop() {
  server.handleClient();

  // ---------------------------------------------------------------------------
  // FAILSAFE PROTECTION:
  // If the motor is running (>0) and we have not received an HTTP command or
  // heartbeat within FAILSAFE_TIMEOUT_MS, immediately shut down the motor!
  // ---------------------------------------------------------------------------
  if (currentMotorSpeed > 0 && (millis() - lastHeartbeat > FAILSAFE_TIMEOUT_MS)) {
    Serial.println("⚠️ [FAILSAFE] Heartbeat lost! Auto-stopping motor for safety.");
    applyMotorSpeed(0);
  }
}
