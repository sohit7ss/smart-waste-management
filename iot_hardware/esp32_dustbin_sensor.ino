#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"
#include "Base64.h"

// ============================================
// CONFIGURATION - CHANGE THESE VALUES
// ============================================
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://YOUR_SERVER_IP:8000";
const char* API_KEY       = "smartbin-iot-key-2026";
const int   DUSTBIN_ID    = 1;
const float BIN_MAX_DEPTH = 50.0; // cm (empty bin depth)

// ============================================
// PIN CONFIGURATION
// ============================================
// Ultrasonic sensor pins
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;

// LED status indicators
const int LED_GREEN  = 2;   // Empty
const int LED_YELLOW = 4;   // Half full
const int LED_RED    = 15;  // Full/Overflow

// Camera pins (ESP32-CAM AI Thinker)
#define PWDN_GPIO_NUM  32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM   0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM     5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22

// ============================================
// SETUP
// ============================================
void setup() {
  Serial.begin(115200);
  
  // Setup pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  
  // Startup LED test
  digitalWrite(LED_RED, HIGH);
  delay(500);
  digitalWrite(LED_YELLOW, HIGH);
  delay(500);
  digitalWrite(LED_GREEN, HIGH);
  delay(500);
  digitalWrite(LED_RED, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_GREEN, LOW);
  
  // Connect to WiFi
  connectWiFi();
  
  // Initialize camera
  initCamera();
  
  Serial.println("SmartBin System Ready!");
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  // Read sensor
  float distance   = readUltrasonic();
  float fillLevel  = calculateFillLevel(distance);
  String status    = getStatus(fillLevel);
  
  // Update LED
  updateLED(status);
  
  // Print to serial
  Serial.println("========================");
  Serial.printf("Distance:   %.1f cm\\n",  distance);
  Serial.printf("Fill Level: %.1f%%\\n",   fillLevel);
  Serial.printf("Status:     %s\\n",       status.c_str());
  
  // Send sensor data to server
  sendSensorData(fillLevel, status, distance);
  
  // Capture and send image every 30 minutes
  captureAndSendImage();
  
  // Deep sleep for 5 minutes to save power
  Serial.println("Sleeping for 5 minutes...");
  // esp_deep_sleep(5 * 60 * 1000000); // uncomment for production
  delay(30000); // 30 seconds for testing
}

// ============================================
// WIFI CONNECTION
// ============================================
void connectWiFi() {
  Serial.printf("Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\nWiFi Connected!");
    Serial.printf("IP Address: %s\\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\\nWiFi Failed! Will retry...");
  }
}

// ============================================
// ULTRASONIC SENSOR
// ============================================
float readUltrasonic() {
  float total = 0;
  for (int i = 0; i < 5; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    
    long duration = pulseIn(ECHO_PIN, HIGH, 30000);
    float distance = duration * 0.034 / 2;
    
    if (distance > 0 && distance < 400) {
      total += distance;
    } else {
      total += BIN_MAX_DEPTH; // assume empty if bad reading
    }
    delay(50);
  }
  return total / 5.0;
}

float calculateFillLevel(float distance) {
  float fill = ((BIN_MAX_DEPTH - distance) / BIN_MAX_DEPTH) * 100.0;
  fill = constrain(fill, 0, 100);
  return fill;
}

String getStatus(float fillLevel) {
  if (fillLevel >= 90) return "overflowing";
  if (fillLevel >= 60) return "full";
  if (fillLevel >= 30) return "half-full";
  return "empty";
}

// ============================================
// LED INDICATOR
// ============================================
void updateLED(String status) {
  digitalWrite(LED_GREEN,  LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED,    LOW);
  
  if (status == "empty")      digitalWrite(LED_GREEN,  HIGH);
  if (status == "half-full")  digitalWrite(LED_YELLOW, HIGH);
  if (status == "full")       digitalWrite(LED_RED,    HIGH);
  if (status == "overflowing") {
    // Blink red for overflow
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_RED, HIGH);
      delay(200);
      digitalWrite(LED_RED, LOW);
      delay(200);
    }
    digitalWrite(LED_RED, HIGH);
  }
}

// ============================================
// SEND DATA TO SERVER
// ============================================
void sendSensorData(float fillLevel, String status, float distance) {
  HTTPClient http;
  String url = String(SERVER_URL) + "/iot/update";
  
  http.begin(url);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("X-API-Key",     API_KEY);
  http.addHeader("X-Device-ID",   String(DUSTBIN_ID));
  
  // Build JSON
  StaticJsonDocument<256> doc;
  doc["dustbin_id"] = DUSTBIN_ID;
  doc["fill_level"] = fillLevel;
  doc["status"]     = status;
  doc["distance"]   = distance;
  doc["battery"]    = getBatteryLevel();
  doc["timestamp"]  = millis();
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int responseCode = http.POST(jsonBody);
  
  if (responseCode == 200) {
    Serial.println("Data sent successfully!");
  } else {
    Serial.printf("Error sending data: %d\\n", responseCode);
  }
  
  http.end();
}

// ============================================
// CAMERA CAPTURE AND SEND
// ============================================
void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  // setup pins omitted for brevity, keeping only essential setup below
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count     = 1;
  
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\\n", err);
  } else {
    Serial.println("Camera initialized!");
  }
}

void captureAndSendImage() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) return;
  
  String imageBase64 = base64::encode(fb->buf, fb->len);
  esp_camera_fb_return(fb);
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/iot/image";
  
  http.begin(url);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("X-API-Key",     API_KEY);
  http.setTimeout(10000);
  
  StaticJsonDocument<1024> doc;
  doc["dustbin_id"] = DUSTBIN_ID;
  doc["image"]      = imageBase64;
  
  String jsonBody;
  serializeJson(doc, jsonBody);
  
  int responseCode = http.POST(jsonBody);
  Serial.printf("Image sent, response: %d\\n", responseCode);
  
  http.end();
}

float getBatteryLevel() {
  int raw = analogRead(34);
  float voltage = (raw / 4095.0) * 3.3 * 2;
  float percent = ((voltage - 3.3) / (4.2 - 3.3)) * 100;
  return constrain(percent, 0, 100);
}
