package com.example.data.model

enum class ConnectionStatus {
    DISCONNECTED,
    TESTING,
    CONNECTED,
    ERROR
}

data class ThrottleState(
    val speed: Int = 0,
    val isArmed: Boolean = false,
    val lastSentSpeed: Int = 0,
    val isTransmitting: Boolean = false
) {
    val percentage: Int
        get() = ((speed * 100f) / 255f).toInt()
}

data class HttpLogItem(
    val id: Long = System.currentTimeMillis(),
    val timestamp: Long = System.currentTimeMillis(),
    val url: String,
    val statusText: String,
    val latencyMs: Long? = null,
    val isSuccess: Boolean = true
)

data class GliderSettings(
    val ipAddress: String = "192.168.137.129",
    val port: Int = 80,
    val timeoutMs: Long = 2000L,
    val failsafeOnCutoff: Boolean = true,
    val hapticFeedback: Boolean = true,
    val autoPingEnabled: Boolean = false
) {
    val baseUrl: String
        get() = if (port == 80) "http://$ipAddress" else "http://$ipAddress:$port"

    fun getMotorUrl(speed: Int): String {
        return "$baseUrl/motor?speed=$speed"
    }
}
