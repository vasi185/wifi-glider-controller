package com.example

import com.example.data.model.GliderSettings
import com.example.data.model.ThrottleState
import org.junit.Assert.assertEquals
import org.junit.Test

class FlightStateTest {

    @Test
    fun testThrottlePercentageCalculation() {
        val stateZero = ThrottleState(speed = 0)
        assertEquals(0, stateZero.percentage)

        val stateHalf = ThrottleState(speed = 128)
        assertEquals(50, stateHalf.percentage)

        val stateFull = ThrottleState(speed = 255)
        assertEquals(100, stateFull.percentage)
    }

    @Test
    fun testGliderSettingsUrlGeneration() {
        val settingsDefault = GliderSettings(ipAddress = "192.168.137.129", port = 80)
        assertEquals("http://192.168.137.129", settingsDefault.baseUrl)
        assertEquals("http://192.168.137.129/motor?speed=128", settingsDefault.getMotorUrl(128))

        val settingsCustomPort = GliderSettings(ipAddress = "192.168.137.200", port = 8080)
        assertEquals("http://192.168.137.200:8080", settingsCustomPort.baseUrl)
        assertEquals("http://192.168.137.200:8080/motor?speed=255", settingsCustomPort.getMotorUrl(255))
    }
}
