package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val CockpitColorScheme = darkColorScheme(
    primary = AeroCyanPrimary,
    onPrimary = Color.Black,
    primaryContainer = CockpitSurfaceVariant,
    onPrimaryContainer = AeroCyanPrimary,
    secondary = ThrustAmber,
    onSecondary = Color.Black,
    secondaryContainer = CockpitSurfaceVariant,
    onSecondaryContainer = ThrustAmberLight,
    tertiary = IndicatorGreen,
    onTertiary = Color.Black,
    background = CockpitBackground,
    onBackground = TextPrimary,
    surface = CockpitSurface,
    onSurface = TextPrimary,
    surfaceVariant = CockpitSurfaceVariant,
    onSurfaceVariant = TextSecondary,
    outline = CockpitBorder,
    error = EmergencyRed,
    onError = Color.White
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = true, // Default to cockpit dark theme for high visibility and contrast
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = CockpitColorScheme,
        typography = Typography,
        content = content
    )
}
