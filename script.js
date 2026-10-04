/**
 * GLIDER CONTROL - Ultra-Smooth, Lag-Free Liquid Glass RC Controller
 * Optimized with RequestAnimationFrame, GPU translate3d, cached layout rects,
 * and zero layout-thrashing for silky-smooth 60-120Hz control stick physics.
 */

(function () {
  'use strict';

  // --- Flight & Transmitter State ---
  const state = {
    isArmed: false,
    flightMode: 'SAFE', // 'SAFE', 'GLIDE', 'POWER'
    
    // Virtual Channels
    throttle: 0, // 0 - 100%
    rudder: 0,   // -100 to +100%
    elevator: 0, // -100 to +100%
    aileron: 0,  // -100 to +100%

    // Trims (-100 to +100)
    trims: {
      throttle: 0,
      rudder: 0,
      elevator: 0,
      aileron: 0
    },

    // ESP32 Local Wi-Fi Link
    espIp: localStorage.getItem('esp_ip') || '192.168.137.129',
    isConnected: false,
    lastPingLatency: null,
    pingIntervalMs: 2500,
    pingTimer: null,
    
    // Motor HTTP micro-batcher
    lastSentPwm: -1,
    pendingPwm: 0,
    isHttpBusy: false,
    pwmSendThrottleTimer: null,

    // Flight Timer
    timerRunning: false,
    timerSeconds: 0,
    timerInterval: null,

    // Audio SFX
    soundEnabled: true,

    // FPS Meter
    fps: 60,
    framesThisSec: 0,
    lastFpsTime: performance.now()
  };

  // --- Cached DOM Nodes ---
  const el = {
    // LCD Screen & HUD
    lcdRxDot: document.getElementById('lcdRxDot'),
    lcdLinkStatus: document.getElementById('lcdLinkStatus'),
    lcdBatt: document.getElementById('lcdBatt'),
    lcdRssiBars: document.getElementById('lcdRssiBars'),
    lcdRssiVal: document.getElementById('lcdRssiVal'),
    lcdMode: document.getElementById('lcdMode'),
    lcdArmBadge: document.getElementById('lcdArmBadge'),
    lcdThrVal: document.getElementById('lcdThrVal'),
    lcdPwmVal: document.getElementById('lcdPwmVal'),
    lcdTimerVal: document.getElementById('lcdTimerVal'),
    lcdIpVal: document.getElementById('lcdIpVal'),
    lcdLatency: document.getElementById('lcdLatency'),
    btnQuickTest: document.getElementById('btnQuickTest'),
    chThrVal: document.getElementById('chThrVal'),
    chRudVal: document.getElementById('chRudVal'),
    chEleVal: document.getElementById('chEleVal'),
    chAilVal: document.getElementById('chAilVal'),
    lcdStatusMsg: document.getElementById('lcdStatusMsg'),
    liquidEnergyFill: document.getElementById('liquidEnergyFill'),
    horizonPitchLine: document.getElementById('horizonPitchLine'),
    horizonAngleLabel: document.getElementById('horizonAngleLabel'),
    fpsDisplay: document.getElementById('fpsDisplay'),

    // Upper Controls
    armToggleSwitch: document.getElementById('armToggleSwitch'),
    armLever: document.getElementById('armLever'),
    armLed: document.getElementById('armLed'),
    armStateText: document.getElementById('armStateText'),
    modeBtnSafe: document.getElementById('modeBtnSafe'),
    modeBtnGlide: document.getElementById('modeBtnGlide'),
    modeBtnPower: document.getElementById('modeBtnPower'),
    modeDescText: document.getElementById('modeDescText'),
    btnEmergencyStop: document.getElementById('btnEmergencyStop'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),

    // Gimbals
    leftHousing: document.getElementById('leftGimbalHousing'),
    leftStick: document.getElementById('leftStick'),
    rightHousing: document.getElementById('rightGimbalHousing'),
    rightStick: document.getElementById('rightStick'),

    // Live Readouts
    valThr: document.getElementById('valThr'),
    valRud: document.getElementById('valRud'),
    valEle: document.getElementById('valEle'),
    valAil: document.getElementById('valAil'),
    valThrTrim: document.getElementById('valThrTrim'),
    valRudTrim: document.getElementById('valRudTrim'),
    valEleTrim: document.getElementById('valEleTrim'),
    valAilTrim: document.getElementById('valAilTrim'),

    // Trims
    trimThrMarker: document.getElementById('trimThrMarker'),
    trimRudMarker: document.getElementById('trimRudMarker'),
    trimEleMarker: document.getElementById('trimEleMarker'),
    trimAilMarker: document.getElementById('trimAilMarker'),
    trimThrUp: document.getElementById('trimThrUp'),
    trimThrDown: document.getElementById('trimThrDown'),
    trimRudLeft: document.getElementById('trimRudLeft'),
    trimRudRight: document.getElementById('trimRudRight'),
    trimEleUp: document.getElementById('trimEleUp'),
    trimEleDown: document.getElementById('trimEleDown'),
    trimAilLeft: document.getElementById('trimAilLeft'),
    trimAilRight: document.getElementById('trimAilRight'),

    // Presets
    preset0: document.getElementById('preset0'),
    preset64: document.getElementById('preset64'),
    preset128: document.getElementById('preset128'),
    preset255: document.getElementById('preset255'),

    // Timer
    btnTimerToggle: document.getElementById('btnTimerToggle'),
    btnTimerReset: document.getElementById('btnTimerReset'),

    // Modals
    armConfirmModal: document.getElementById('armConfirmModal'),
    chkClearArea: document.getElementById('chkClearArea'),
    chkThrottleZero: document.getElementById('chkThrottleZero'),
    btnCancelArm: document.getElementById('btnCancelArm'),
    btnConfirmArm: document.getElementById('btnConfirmArm'),

    settingsModal: document.getElementById('settingsModal'),
    inputEspIp: document.getElementById('inputEspIp'),
    selectPingRate: document.getElementById('selectPingRate'),
    chkSoundFx: document.getElementById('chkSoundFx'),
    btnTestFromSettings: document.getElementById('btnTestFromSettings'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    btnSaveSettings: document.getElementById('btnSaveSettings')
  };

  // --- Synthetic Web Audio API Sound Effects ---
  const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
  function playBeep(freq = 880, duration = 0.04, type = 'sine') {
    if (!state.soundEnabled || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  // --- High-Performance Cached Gimbal Kinematics ---
  // Store cached bounding boxes to completely prevent layout thrashing on pointermove!
  const leftGimbalGeometry = { centerX: 0, centerY: 0, maxDistance: 48 };
  const rightGimbalGeometry = { centerX: 0, centerY: 0, maxDistance: 48 };

  function refreshGimbalGeometries() {
    if (el.leftHousing) {
      const rectL = el.leftHousing.getBoundingClientRect();
      const radiusL = rectL.width / 2;
      leftGimbalGeometry.centerX = rectL.left + radiusL;
      leftGimbalGeometry.centerY = rectL.top + radiusL;
      leftGimbalGeometry.maxDistance = radiusL * 0.72;
    }
    if (el.rightHousing) {
      const rectR = el.rightHousing.getBoundingClientRect();
      const radiusR = rectR.width / 2;
      rightGimbalGeometry.centerX = rectR.left + radiusR;
      rightGimbalGeometry.centerY = rectR.top + radiusR;
      rightGimbalGeometry.maxDistance = radiusR * 0.72;
    }
  }

  window.addEventListener('resize', refreshGimbalGeometries, { passive: true });
  window.addEventListener('scroll', refreshGimbalGeometries, { passive: true });

  // --- Setup Multi-Touch Pointers Without Reflow ---
  function setupLagFreeGimbal(housing, stick, isLeftGimbal) {
    let activePointerId = null;

    housing.addEventListener('pointerdown', (e) => {
      activePointerId = e.pointerId;
      try {
        housing.setPointerCapture(e.pointerId);
      } catch (err) {}

      // Refresh geometry only on touch start
      refreshGimbalGeometries();
      playBeep(1100, 0.02);
      processPointerCoord(e.clientX, e.clientY, isLeftGimbal);
    }, { passive: false });

    housing.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activePointerId) return;
      processPointerCoord(e.clientX, e.clientY, isLeftGimbal);
    }, { passive: true });

    function onPointerRelease(e) {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      try {
        housing.releasePointerCapture(e.pointerId);
      } catch (err) {}

      if (isLeftGimbal) {
        // Rudder snaps back to center (0), Throttle stays where released
        state.rudder = 0;
      } else {
        // Right stick snaps back to center (0, 0)
        state.aileron = 0;
        state.elevator = 0;
      }
    }

    housing.addEventListener('pointerup', onPointerRelease, { passive: true });
    housing.addEventListener('pointercancel', onPointerRelease, { passive: true });
  }

  function processPointerCoord(clientX, clientY, isLeftGimbal) {
    const geo = isLeftGimbal ? leftGimbalGeometry : rightGimbalGeometry;
    let dx = clientX - geo.centerX;
    let dy = clientY - geo.centerY;

    const distance = Math.hypot(dx, dy);
    if (distance > geo.maxDistance) {
      const scale = geo.maxDistance / distance;
      dx *= scale;
      dy *= scale;
    }

    const normX = dx / geo.maxDistance;
    const normY = dy / geo.maxDistance;

    if (isLeftGimbal) {
      state.rudder = Math.round(normX * 100);
      const rawThr = Math.round(((1 - normY) / 2) * 100);
      state.throttle = Math.max(0, Math.min(100, rawThr));
      queueMotorUpdate(false);
    } else {
      state.aileron = Math.round(normX * 100);
      state.elevator = Math.round(-normY * 100);
    }
  }

  // --- 60+ FPS Hardware-Accelerated Animation Loop ---
  let lastThrDisplay = -1;
  let lastRudDisplay = -999;
  let lastEleDisplay = -999;
  let lastAilDisplay = -999;
  let lastPwmDisplay = -1;

  function renderFrame(now) {
    // 1. Calculate FPS
    state.framesThisSec++;
    if (now - state.lastFpsTime >= 1000) {
      state.fps = state.framesThisSec;
      state.framesThisSec = 0;
      state.lastFpsTime = now;
      if (el.fpsDisplay) {
        el.fpsDisplay.textContent = `${state.fps} FPS`;
      }
    }

    // 2. Hardware-Accelerated Stick Transforms using translate3d
    const maxTravelPx = 48;

    // Left Stick (X = Rudder, Y = Throttle: 0% at bottom, 100% at top)
    const leftX = (state.rudder / 100) * maxTravelPx;
    const leftY = (1 - (state.throttle / 50)) * maxTravelPx;
    el.leftStick.style.transform = `translate3d(${leftX}px, ${leftY}px, 0)`;

    // Right Stick (X = Aileron, Y = Elevator: +100% Up, -100% Down)
    const rightX = (state.aileron / 100) * maxTravelPx;
    const rightY = -(state.elevator / 100) * maxTravelPx;
    el.rightStick.style.transform = `translate3d(${rightX}px, ${rightY}px, 0)`;

    // 3. Fluid Horizon Tilt & Pitch Line
    if (el.horizonPitchLine) {
      const pitchOffset = -(state.elevator * 0.12);
      const rollAngle = (state.aileron * 0.25);
      el.horizonPitchLine.style.transform = `translate3d(0, ${pitchOffset}px, 0) rotate(${rollAngle}deg)`;
      
      if (el.horizonAngleLabel) {
        if (Math.abs(state.elevator) < 5 && Math.abs(state.aileron) < 5) {
          el.horizonAngleLabel.textContent = 'LEVEL';
        } else {
          el.horizonAngleLabel.textContent = `P:${state.elevator > 0 ? '+' : ''}${state.elevator}° R:${state.aileron > 0 ? '+' : ''}${state.aileron}°`;
        }
      }
    }

    // 4. Update Readouts only if changed (prevents DOM reflows)
    const pwm = getEffectivePwm();

    if (state.throttle !== lastThrDisplay) {
      lastThrDisplay = state.throttle;
      el.lcdThrVal.textContent = `${state.throttle}%`;
      el.chThrVal.textContent = `${state.throttle}%`;
      el.valThr.textContent = `${state.throttle}%`;
      if (el.liquidEnergyFill) {
        el.liquidEnergyFill.style.width = `${state.throttle}%`;
      }
    }

    if (pwm !== lastPwmDisplay) {
      lastPwmDisplay = pwm;
      el.lcdPwmVal.textContent = `${pwm}`;
    }

    if (state.rudder !== lastRudDisplay) {
      lastRudDisplay = state.rudder;
      const str = `${state.rudder > 0 ? '+' : ''}${state.rudder}%`;
      el.chRudVal.textContent = str;
      el.valRud.textContent = str;
    }

    if (state.elevator !== lastEleDisplay) {
      lastEleDisplay = state.elevator;
      const str = `${state.elevator > 0 ? '+' : ''}${state.elevator}%`;
      el.chEleVal.textContent = str;
      el.valEle.textContent = str;
    }

    if (state.aileron !== lastAilDisplay) {
      lastAilDisplay = state.aileron;
      const str = `${state.aileron > 0 ? '+' : ''}${state.aileron}%`;
      el.chAilVal.textContent = str;
      el.valAil.textContent = str;
    }

    requestAnimationFrame(renderFrame);
  }

  // --- Network Communication Engine ---
  function getEffectivePwm() {
    if (!state.isArmed || state.flightMode === 'SAFE') return 0;
    let effThrottle = state.throttle;
    if (state.flightMode === 'GLIDE') {
      effThrottle = Math.min(effThrottle, 30);
    }
    const pwm = Math.round((effThrottle / 100) * 255);
    return Math.max(0, Math.min(255, pwm));
  }

  function queueMotorUpdate(immediate = false) {
    const pwm = getEffectivePwm();
    state.pendingPwm = pwm;

    if (immediate) {
      sendMotorPwm(pwm);
      return;
    }

    if (!state.pwmSendThrottleTimer) {
      state.pwmSendThrottleTimer = setTimeout(() => {
        state.pwmSendThrottleTimer = null;
        sendMotorPwm(state.pendingPwm);
      }, 65); // ~15Hz transmission rate prevents Wi-Fi queue bloat
    }
  }

  async function sendMotorPwm(pwm) {
    if (pwm === state.lastSentPwm || state.isHttpBusy) return;
    state.lastSentPwm = pwm;
    state.isHttpBusy = true;

    const url = `http://${state.espIp}/motor?speed=${pwm}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const resp = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        setConnectionState(true);
      }
    } catch (err) {
      // Silently handled in background
    } finally {
      state.isHttpBusy = false;
      // If a newer PWM arrived while sending, send it immediately
      if (state.pendingPwm !== state.lastSentPwm) {
        sendMotorPwm(state.pendingPwm);
      }
    }
  }

  async function checkEspStatus() {
    const url = `http://${state.espIp}/status`;
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const resp = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - startTime);
      if (resp.ok) {
        let data = {};
        try {
          data = await resp.json();
        } catch (e) {}
        setConnectionState(true, latency, data);
      } else {
        setConnectionState(false);
      }
    } catch (err) {
      setConnectionState(false);
    }
  }

  function setConnectionState(connected, latency = null, data = {}) {
    state.isConnected = connected;
    state.lastPingLatency = latency;

    if (connected) {
      el.lcdRxDot.className = 'status-dot connected';
      el.lcdLinkStatus.textContent = 'CONNECTED';
      el.lcdLatency.textContent = latency ? `${latency}ms` : 'OK';
      el.lcdRssiVal.textContent = data.rssi ? `${data.rssi}dBm` : '100%';
      el.lcdBatt.textContent = data.voltage ? `${data.voltage}V` : '12.4V';
      el.lcdStatusMsg.textContent = state.isArmed ? 'LINK ACTIVE / ARMED' : 'LINK ACTIVE / SAFE';
    } else {
      el.lcdRxDot.className = 'status-dot disconnected';
      el.lcdLinkStatus.textContent = 'DISCONNECTED';
      el.lcdLatency.textContent = 'TIMEOUT';
      el.lcdRssiVal.textContent = '0%';
      el.lcdBatt.textContent = 'N/A';
      el.lcdStatusMsg.textContent = 'NO ESP32 LINK (HOTSPOT)';
    }
  }

  function setupPingTimer() {
    if (state.pingTimer) {
      clearInterval(state.pingTimer);
      state.pingTimer = null;
    }
    if (state.pingIntervalMs > 0) {
      state.pingTimer = setInterval(checkEspStatus, state.pingIntervalMs);
    }
  }

  // --- Arming & Emergency Stop ---
  function promptArmConfirmation() {
    if (state.isArmed) {
      disarmSystem();
      return;
    }
    el.chkClearArea.checked = false;
    el.chkThrottleZero.checked = state.throttle === 0;
    el.btnConfirmArm.disabled = !(el.chkClearArea.checked && el.chkThrottleZero.checked);
    el.armConfirmModal.classList.add('active');
    playBeep(440, 0.1);
  }

  function confirmArm() {
    el.armConfirmModal.classList.remove('active');
    state.isArmed = true;

    el.armToggleSwitch.classList.add('armed');
    el.armLed.classList.add('active');
    el.armStateText.textContent = '● ARMED';
    el.armStateText.style.color = '#ef4444';

    el.lcdArmBadge.className = 'lcd-badge arm-badge armed';
    el.lcdArmBadge.textContent = 'ARMED';
    el.lcdStatusMsg.textContent = 'MOTOR ARMED - LIVE!';

    playBeep(920, 0.25, 'triangle');
    queueMotorUpdate(true);
  }

  function disarmSystem() {
    state.isArmed = false;

    el.armToggleSwitch.classList.remove('armed');
    el.armLed.classList.remove('active');
    el.armStateText.textContent = 'DISARMED';
    el.armStateText.style.color = '#64748b';

    el.lcdArmBadge.className = 'lcd-badge arm-badge disarmed';
    el.lcdArmBadge.textContent = 'DISARMED';
    el.lcdStatusMsg.textContent = 'SYSTEM DISARMED (SAFE)';

    playBeep(320, 0.2, 'sine');
    sendMotorPwm(0);
  }

  function emergencyMotorStop() {
    playBeep(220, 0.35, 'sawtooth');
    state.throttle = 0;
    disarmSystem();
    sendMotorPwm(0);

    el.lcdStatusMsg.textContent = '⚠️ EMERGENCY STOP ACTIVATED!';
    setTimeout(() => {
      if (!state.isArmed) el.lcdStatusMsg.textContent = 'READY / SAFE';
    }, 3000);
  }

  // --- Flight Mode Selection ---
  function setFlightMode(mode) {
    state.flightMode = mode;
    playBeep(660, 0.06);

    [el.modeBtnSafe, el.modeBtnGlide, el.modeBtnPower].forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    el.lcdMode.textContent = mode;

    if (mode === 'SAFE') {
      el.modeDescText.textContent = 'Motor Locked (0)';
      el.lcdStatusMsg.textContent = 'SAFE MODE - MOTOR INHIBITED';
    } else if (mode === 'GLIDE') {
      el.modeDescText.textContent = 'Thermal Glide (Limit 30%)';
      el.lcdStatusMsg.textContent = 'GLIDE MODE ACTIVE';
    } else {
      el.modeDescText.textContent = 'Full Power (0-255)';
      el.lcdStatusMsg.textContent = 'FULL POWER FLIGHT';
    }

    queueMotorUpdate(true);
  }

  // --- Throttle Preset Buttons ---
  function setThrottlePreset(pwmVal) {
    const pct = Math.round((pwmVal / 255) * 100);
    state.throttle = pct;
    playBeep(750, 0.05);
    queueMotorUpdate(true);
  }

  // --- Trim Buttons & Steppers ---
  function adjustTrim(axis, delta) {
    state.trims[axis] = Math.max(-100, Math.min(100, state.trims[axis] + delta));
    playBeep(1100 + state.trims[axis] * 3, 0.03);

    if (axis === 'throttle') {
      el.valThrTrim.textContent = state.trims.throttle;
      const posPct = 50 - (state.trims.throttle * 0.4);
      el.trimThrMarker.style.top = `${posPct}%`;
    } else if (axis === 'rudder') {
      el.valRudTrim.textContent = state.trims.rudder;
      const posPct = 50 + (state.trims.rudder * 0.4);
      el.trimRudMarker.style.left = `${posPct}%`;
    } else if (axis === 'elevator') {
      el.valEleTrim.textContent = state.trims.elevator;
      const posPct = 50 - (state.trims.elevator * 0.4);
      el.trimEleMarker.style.top = `${posPct}%`;
    } else if (axis === 'aileron') {
      el.valAilTrim.textContent = state.trims.aileron;
      const posPct = 50 + (state.trims.aileron * 0.4);
      el.trimAilMarker.style.left = `${posPct}%`;
    }
  }

  // --- Flight Timer ---
  function toggleFlightTimer() {
    if (state.timerRunning) {
      clearInterval(state.timerInterval);
      state.timerRunning = false;
      el.btnTimerToggle.textContent = 'RESUME';
    } else {
      state.timerRunning = true;
      el.btnTimerToggle.textContent = 'PAUSE';
      state.timerInterval = setInterval(() => {
        state.timerSeconds++;
        const mins = String(Math.floor(state.timerSeconds / 60)).padStart(2, '0');
        const secs = String(state.timerSeconds % 60).padStart(2, '0');
        el.lcdTimerVal.textContent = `${mins}:${secs}`;
      }, 1000);
    }
    playBeep(800, 0.05);
  }

  function resetFlightTimer() {
    clearInterval(state.timerInterval);
    state.timerRunning = false;
    state.timerSeconds = 0;
    el.lcdTimerVal.textContent = '00:00';
    el.btnTimerToggle.textContent = 'START TIMER';
    playBeep(500, 0.05);
  }

  // --- Settings & Hotspot ---
  function openSettings() {
    el.inputEspIp.value = state.espIp;
    el.selectPingRate.value = String(state.pingIntervalMs);
    el.chkSoundFx.checked = state.soundEnabled;
    el.settingsModal.classList.add('active');
  }

  function saveSettings() {
    const rawIp = el.inputEspIp.value.trim();
    if (rawIp) {
      state.espIp = rawIp;
      localStorage.setItem('esp_ip', rawIp);
      el.lcdIpVal.textContent = rawIp;
    }

    state.pingIntervalMs = parseInt(el.selectPingRate.value, 10);
    state.soundEnabled = el.chkSoundFx.checked;

    setupPingTimer();
    checkEspStatus();
    el.settingsModal.classList.remove('active');
    playBeep(900, 0.08);
  }

  // --- Keyboard Shortcuts for Desktop Testing ---
  function handleKeyDown(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      emergencyMotorStop();
      return;
    }
    if (e.code === 'KeyW') {
      state.throttle = Math.min(100, state.throttle + 5);
      queueMotorUpdate(false);
    } else if (e.code === 'KeyS') {
      state.throttle = Math.max(0, state.throttle - 5);
      queueMotorUpdate(false);
    }
  }

  // --- Initializer ---
  function init() {
    refreshGimbalGeometries();

    // Setup Gimbals
    setupLagFreeGimbal(el.leftHousing, el.leftStick, true);
    setupLagFreeGimbal(el.rightHousing, el.rightStick, false);

    // Arming Modal
    el.armToggleSwitch.addEventListener('click', promptArmConfirmation);
    const validateChecklist = () => {
      el.btnConfirmArm.disabled = !(el.chkClearArea.checked && el.chkThrottleZero.checked);
    };
    el.chkClearArea.addEventListener('change', validateChecklist);
    el.chkThrottleZero.addEventListener('change', validateChecklist);
    el.btnConfirmArm.addEventListener('click', confirmArm);
    el.btnCancelArm.addEventListener('click', () => {
      el.armConfirmModal.classList.remove('active');
      disarmSystem();
    });

    // Emergency Stop
    el.btnEmergencyStop.addEventListener('click', emergencyMotorStop);

    // Flight Mode
    el.modeBtnSafe.addEventListener('click', () => setFlightMode('SAFE'));
    el.modeBtnGlide.addEventListener('click', () => setFlightMode('GLIDE'));
    el.modeBtnPower.addEventListener('click', () => setFlightMode('POWER'));

    // Presets
    el.preset0.addEventListener('click', () => setThrottlePreset(0));
    el.preset64.addEventListener('click', () => setThrottlePreset(64));
    el.preset128.addEventListener('click', () => setThrottlePreset(128));
    el.preset255.addEventListener('click', () => setThrottlePreset(255));

    // Trims
    el.trimThrUp.addEventListener('click', () => adjustTrim('throttle', 5));
    el.trimThrDown.addEventListener('click', () => adjustTrim('throttle', -5));
    el.trimRudLeft.addEventListener('click', () => adjustTrim('rudder', -5));
    el.trimRudRight.addEventListener('click', () => adjustTrim('rudder', 5));
    el.trimEleUp.addEventListener('click', () => adjustTrim('elevator', 5));
    el.trimEleDown.addEventListener('click', () => adjustTrim('elevator', -5));
    el.trimAilLeft.addEventListener('click', () => adjustTrim('aileron', -5));
    el.trimAilRight.addEventListener('click', () => adjustTrim('aileron', 5));

    // Timer
    el.btnTimerToggle.addEventListener('click', toggleFlightTimer);
    el.btnTimerReset.addEventListener('click', resetFlightTimer);

    // Settings
    el.btnOpenSettings.addEventListener('click', openSettings);
    el.btnCloseSettings.addEventListener('click', () => el.settingsModal.classList.remove('active'));
    el.btnSaveSettings.addEventListener('click', saveSettings);
    el.btnQuickTest.addEventListener('click', () => {
      playBeep(700, 0.05);
      checkEspStatus();
    });
    el.btnTestFromSettings.addEventListener('click', () => {
      state.espIp = el.inputEspIp.value.trim() || state.espIp;
      checkEspStatus();
    });

    // Keyboard support
    window.addEventListener('keydown', handleKeyDown);

    // Initial setup & network ping
    el.lcdIpVal.textContent = state.espIp;
    setupPingTimer();
    checkEspStatus();

    // Start 60+ FPS Rendering Loop
    requestAnimationFrame(renderFrame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
