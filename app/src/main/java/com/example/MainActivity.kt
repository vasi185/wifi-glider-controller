package com.example

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.AeroCyanPrimary
import com.example.ui.theme.CockpitBackground
import com.example.ui.theme.CockpitBorder
import com.example.ui.theme.CockpitSurface
import com.example.ui.theme.CockpitSurfaceVariant
import com.example.ui.theme.EmergencyRed
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary
import com.example.ui.theme.ThrustAmber

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                GliderControlApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GliderControlApp() {
    val context = LocalContext.current
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var showCodeDialog by remember { mutableStateOf(false) }
    var showWindowsGuideDialog by remember { mutableStateOf(false) }
    var showExitConfirmDialog by remember { mutableStateOf(false) }

    // Intercept back button to prevent accidental exit during flight
    BackHandler {
        showExitConfirmDialog = true
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = AeroCyanPrimary.copy(alpha = 0.15f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, AeroCyanPrimary)
                        ) {
                            Text(
                                text = "2.4GHz Wi-Fi",
                                color = AeroCyanPrimary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                        Text(
                            text = "GLIDER CONTROL",
                            color = TextPrimary,
                            fontWeight = FontWeight.Black,
                            fontSize = 16.sp,
                            letterSpacing = 1.sp
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = { showCodeDialog = true },
                        modifier = Modifier.testTag("btn_view_arduino_code")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Code,
                            contentDescription = "ESP32 Firmware Code",
                            tint = AeroCyanPrimary
                        )
                    }

                    IconButton(
                        onClick = { showWindowsGuideDialog = true },
                        modifier = Modifier.testTag("btn_windows_guide")
                    ) {
                        Icon(
                            imageVector = Icons.Default.HelpOutline,
                            contentDescription = "Windows Hotspot & Local Setup Guide",
                            tint = ThrustAmber
                        )
                    }

                    IconButton(
                        onClick = {
                            webViewInstance?.reload()
                            Toast.makeText(context, "Transmitter reloaded", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.testTag("btn_reload_transmitter")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Reload Transmitter",
                            tint = TextSecondary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CockpitSurface,
                    titleContentColor = TextPrimary
                )
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(CockpitBackground)
        ) {
            TransmitterWebView(
                onWebViewReady = { wv ->
                    webViewInstance = wv
                }
            )
        }
    }

    // Modal: Arduino C++ ESP32 Firmware
    if (showCodeDialog) {
        ArduinoFirmwareDialog(
            onDismiss = { showCodeDialog = false },
            onCopyCode = { code ->
                copyToClipboard(context, "ESP32_Glider_Firmware", code)
                Toast.makeText(context, "Arduino code copied to clipboard!", Toast.LENGTH_SHORT).show()
            }
        )
    }

    // Modal: Windows Hotspot & Local Website Run Guide
    if (showWindowsGuideDialog) {
        WindowsSetupGuideDialog(
            onDismiss = { showWindowsGuideDialog = false },
            onCopyInstructions = { guide ->
                copyToClipboard(context, "Windows_Glider_Instructions", guide)
                Toast.makeText(context, "Setup guide copied!", Toast.LENGTH_SHORT).show()
            }
        )
    }

    // Modal: Exit confirmation during flight
    if (showExitConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showExitConfirmDialog = false },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = ThrustAmber) },
            title = { Text("Exit Glider Controller?", color = TextPrimary) },
            text = {
                Text(
                    "Exiting will cut telemetry link. Make sure the motor is stopped before closing.",
                    color = TextSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showExitConfirmDialog = false
                        (context as? ComponentActivity)?.finish()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = EmergencyRed)
                ) {
                    Text("Exit")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showExitConfirmDialog = false }) {
                    Text("Stay in Cockpit")
                }
            },
            containerColor = CockpitSurfaceVariant
        )
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TransmitterWebView(
    modifier: Modifier = Modifier,
    onWebViewReady: (WebView) -> Unit
) {
    AndroidView(
        modifier = modifier
            .fillMaxSize()
            .testTag("transmitter_webview"),
        factory = { ctx ->
            WebView(ctx).apply {
                // Hardware layer acceleration for lag-free 60-120 FPS glass rendering
                setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                overScrollMode = android.view.View.OVER_SCROLL_NEVER

                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    allowFileAccess = true
                    allowContentAccess = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    setSupportZoom(false)
                    builtInZoomControls = false
                    displayZoomControls = false
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    cacheMode = WebSettings.LOAD_DEFAULT
                }
                webViewClient = WebViewClient()
                webChromeClient = WebChromeClient()
                loadUrl("file:///android_asset/web/index.html")
                onWebViewReady(this)
            }
        },
        update = { wv ->
            onWebViewReady(wv)
        }
    )
}

@Composable
fun ArduinoFirmwareDialog(
    onDismiss: () -> Unit,
    onCopyCode: (String) -> Unit
) {
    val sampleCode = remember {
        """
/*
  GLIDER CONTROL - ESP32 Glider Flight Controller Firmware
  Connects to Laptop Wi-Fi Hotspot (STA mode)
  Endpoints:
    GET /status            -> RSSI, status, motor PWM
    GET /motor?speed=0-255 -> Sets motor PWM
*/

#include <WiFi.h>
#include <WebServer.h>

const char* WIFI_SSID     = "MyLaptopHotspot";
const char* WIFI_PASSWORD = "GliderPassword123";

const int MOTOR_PWM_PIN = 18;  // L293D EN1
const int MOTOR_IN1_PIN = 19;  // L293D IN1
const int MOTOR_IN2_PIN = 21;  // L293D IN2
const int LED_PIN       = 2;

const int PWM_FREQ       = 20000;
const int PWM_CHANNEL    = 0;
const int PWM_RESOLUTION = 8;

WebServer server(80);
volatile int currentMotorSpeed = 0;
unsigned long lastHeartbeat = 0;
const unsigned long FAILSAFE_TIMEOUT_MS = 3500;

void sendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
}

void applyMotorSpeed(int speed) {
  speed = constrain(speed, 0, 255);
  currentMotorSpeed = speed;
  if (speed == 0) {
    digitalWrite(MOTOR_IN1_PIN, LOW);
    digitalWrite(MOTOR_IN2_PIN, LOW);
    ledcWrite(PWM_CHANNEL, 0);
    digitalWrite(LED_PIN, LOW);
  } else {
    digitalWrite(MOTOR_IN1_PIN, HIGH);
    digitalWrite(MOTOR_IN2_PIN, LOW);
    ledcWrite(PWM_CHANNEL, speed);
    digitalWrite(LED_PIN, HIGH);
  }
}

void handleStatus() {
  sendCors();
  lastHeartbeat = millis();
  String json = "{\"status\":\"ok\",\"rssi\":" + String(WiFi.RSSI()) +
                ",\"motor\":" + String(currentMotorSpeed) + ",\"voltage\":\"N/A\"}";
  server.send(200, "application/json", json);
}

void handleMotor() {
  sendCors();
  lastHeartbeat = millis();
  if (server.hasArg("speed")) {
    int speed = server.arg("speed").toInt();
    applyMotorSpeed(speed);
    server.send(200, "application/json", "{\"status\":\"ok\",\"speed\":" + String(currentMotorSpeed) + "}");
  } else {
    server.send(400, "application/json", "{\"error\":\"Missing speed\"}");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(MOTOR_IN1_PIN, OUTPUT);
  pinMode(MOTOR_IN2_PIN, OUTPUT);

  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(MOTOR_PWM_PIN, PWM_CHANNEL);
  applyMotorSpeed(0);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Connected! IP: " + WiFi.localIP().toString());

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/motor", HTTP_GET, handleMotor);
  server.on("/status", HTTP_OPTIONS, []() { sendCors(); server.send(204); });
  server.on("/motor", HTTP_OPTIONS, []() { sendCors(); server.send(204); });
  server.begin();
}

void loop() {
  server.handleClient();
  if (currentMotorSpeed > 0 && (millis() - lastHeartbeat > FAILSAFE_TIMEOUT_MS)) {
    applyMotorSpeed(0); // Failsafe shut-off
  }
}
        """.trimIndent()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Code, contentDescription = null, tint = AeroCyanPrimary)
                Text("ESP32 Arduino Firmware", color = TextPrimary, fontSize = 16.sp)
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(380.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = "L293D + Hotspot Wi-Fi (STA Mode) Sketch:",
                    color = ThrustAmber,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                Card(
                    colors = CardDefaults.cardColors(containerColor = CockpitBackground),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CockpitBorder)
                ) {
                    Text(
                        text = sampleCode,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = Color(0xFF59F0A8),
                        modifier = Modifier.padding(10.dp)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onCopyCode(sampleCode) },
                colors = ButtonDefaults.buttonColors(containerColor = AeroCyanPrimary)
            ) {
                Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Copy Code", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text("Close")
            }
        },
        containerColor = CockpitSurfaceVariant
    )
}

@Composable
fun WindowsSetupGuideDialog(
    onDismiss: () -> Unit,
    onCopyInstructions: (String) -> Unit
) {
    val guideText = remember {
        """
HOW TO RUN "GLIDER CONTROL" LOCALLY ON WINDOWS:

Step 1: Enable Windows Mobile Hotspot
1. On your Windows laptop, open Settings -> Network & Internet -> Mobile Hotspot.
2. Turn Mobile Hotspot ON.
3. Note the Network name (SSID) and Password (e.g. MyLaptopHotspot / GliderPassword123).

Step 2: Flash the ESP32
1. Open the Arduino IDE on your laptop.
2. Enter your Hotspot SSID and Password into the provided Arduino sketch.
3. Connect the L293D motor driver:
   - ESP32 GPIO 18 -> L293D EN1 (Speed PWM)
   - ESP32 GPIO 19 -> L293D IN1
   - ESP32 GPIO 21 -> L293D IN2
   - L293D OUT1 & OUT2 -> Coreless DC Motor
4. Flash the sketch to the ESP32 and open Serial Monitor at 115200 baud.
5. Once connected, the ESP32 will print its IP (e.g., 192.168.137.129).

Step 3: Run the Controller Web App on your Laptop (No Internet Required!)
Option A (Direct File):
- Double click "index.html" on your laptop to open in Chrome or Edge!

Option B (Local Python Web Server):
- Open PowerShell in the project folder and run:
  python -m http.server 8000
- Then open: http://localhost:8000 in your browser.

Step 4: Connect & Fly
1. On the GLIDER CONTROL screen, click ⚙️ SETUP.
2. Enter the ESP32 IP address (e.g. 192.168.137.129).
3. Click "Test Status".
4. When RX indicator turns GREEN ● CONNECTED:
   - Click the ARM switch.
   - Confirm safety checks.
   - Move the Left Stick up to control throttle!
   - Press the big red MOTOR STOP button for instant cut-off.
        """.trimIndent()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.HelpOutline, contentDescription = null, tint = ThrustAmber)
                Text("Windows Hotspot & Local Setup", color = TextPrimary, fontSize = 16.sp)
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(380.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = CockpitBackground),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CockpitBorder)
                ) {
                    Text(
                        text = guideText,
                        fontSize = 11.sp,
                        lineHeight = 16.sp,
                        color = TextSecondary,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onCopyInstructions(guideText) },
                colors = ButtonDefaults.buttonColors(containerColor = ThrustAmber)
            ) {
                Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Copy Guide", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text("Close")
            }
        },
        containerColor = CockpitSurfaceVariant
    )
}

fun copyToClipboard(context: Context, label: String, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText(label, text)
    clipboard.setPrimaryClip(clip)
}
