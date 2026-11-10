// ============================================================================
// FOTO-LIVE PRO CAMERA ENGINE - NATIVE CAMERA UI, 0.5x/1x/2x ZOOM & AUTO-SAVE
// ============================================================================

// --- Camera & App State ---
let currentStream = null;
let currentFacingMode = 'environment'; // 'environment' (Belakang) | 'user' (Depan)
let cameraMode = 'live'; // 'portrait' | 'photo' | 'live' | 'video'
let isLiveActive = true;
let isCapturing = false;
let isRecordingVideo = false;
let videoMediaRecorder = null;
let videoRecordedChunks = [];
let videoTimerInterval = null;
let videoStartTime = 0;

let flashMode = 'off'; // 'off' | 'auto' | 'on' | 'torch'
let timerSeconds = 0; // 0 | 3 | 10
let aspectRatio = 'full'; // 'full' | '4:3' | '16:9' | '1:1'
let activeFilter = 'none'; // 'none' | 'vivid' | 'warm' | 'cool' | 'dramatic' | 'mono'
let currentZoom = 1; // 0.5 | 1 | 2 (plus pinch 0.5 - 4.0)
let currentExposure = 0; // -2.0 to +2.0

// Multi-lens & Hardware Zoom state
let availableRearDevices = [];
let ultraWideDeviceId = null;
let mainRearDeviceId = null;
let teleRearDeviceId = null;
let activeDeviceId = null;
let hwSupportsSub1x = false;

// Sensor calibration so 0.5x (Ultra-Wide), 1x (Normal), and 2x (Tele) ALWAYS work visibly on every device!
// When a phone only exposes 1 sensor with min zoom = 1.0:
// - 0.5x uses 1.0x (100% full wide sensor width, zero crop)
// - 1.0x uses 1.32x (natural 26mm main camera framing)
// - 2.0x uses 2.64x (52mm 2x optical/digital telephoto framing)
const BASE_1X_SENSOR_FACTOR = 1.32;

// Settings persisted in localStorage
let isAutoSaveActive = localStorage.getItem('fotolive_autosave') !== 'false'; // Default: ON
let isAutoSaveVideoClip = localStorage.getItem('fotolive_autosave_clip') === 'true'; // Default: OFF (hanya foto utama, atau ON jika diaktifkan)
let isGridActive = localStorage.getItem('fotolive_grid') !== 'false'; // Default: ON
let isSoundActive = localStorage.getItem('fotolive_sound') !== 'false'; // Default: ON
let isMirrorSelfie = localStorage.getItem('fotolive_mirror') !== 'false'; // Default: ON

let isSimulationMode = false;
let simAnimFrame = null;
let deferredInstallPrompt = null;
let db = null;

// Gallery state
let galleryItems = [];
let activeItemIndex = 0;
let isGalleryGridOpen = false;

// --- Filter CSS Definitions ---
const FILTER_MAP = {
  none: 'none',
  vivid: 'saturate(1.45) contrast(1.12)',
  warm: 'sepia(0.28) saturate(1.35) brightness(1.03)',
  cool: 'hue-rotate(14deg) saturate(1.15) brightness(1.02)',
  dramatic: 'contrast(1.32) saturate(0.82) brightness(0.94)',
  mono: 'grayscale(1) contrast(1.22)'
};

// --- DOM Elements ---
const videoEl = document.getElementById('camera-video');
const simCanvas = document.getElementById('sim-canvas');
const captureCanvas = document.getElementById('capture-canvas');
const viewfinderWrapper = document.getElementById('viewfinder-wrapper');
const viewfinderFrame = document.getElementById('viewfinder-frame');
const portraitVignette = document.getElementById('portrait-vignette');
const gridOverlay = document.getElementById('grid-overlay');
const focusReticle = document.getElementById('focus-reticle');
const exposureSlider = document.getElementById('exposure-slider');
const permOverlay = document.getElementById('camera-permission-overlay');
const permDesc = document.getElementById('perm-desc');
const btnRetryCamera = document.getElementById('btn-retry-camera');
const btnSimCamera = document.getElementById('btn-sim-camera');

const recordingHud = document.getElementById('recording-hud');
const recordingHudText = document.getElementById('recording-hud-text');
const savedBadge = document.getElementById('saved-badge');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const flashScreen = document.getElementById('flash-screen');

// Top Bar Controls
const flashToggle = document.getElementById('flash-toggle');
const flashBadge = document.getElementById('flash-badge');
const liveToggle = document.getElementById('live-toggle');
const liveStatusText = document.getElementById('live-status-text');
const videoTimerPill = document.getElementById('video-timer-pill');
const videoTimerText = document.getElementById('video-timer-text');
const installBtn = document.getElementById('btn-install');
const timerToggle = document.getElementById('timer-toggle');
const timerBadge = document.getElementById('timer-badge');
const ratioToggle = document.getElementById('ratio-toggle');
const ratioText = document.getElementById('ratio-text');
const filterToggle = document.getElementById('filter-toggle');
const filterStrip = document.getElementById('filter-strip');
const settingsToggle = document.getElementById('settings-toggle');
const settingsTray = document.getElementById('settings-tray');
const closeSettingsBtn = document.getElementById('close-settings-btn');

// Settings Tray Buttons
const autosaveToggle = document.getElementById('autosave-toggle');
const autosaveState = document.getElementById('autosave-state');
const autosaveVideoToggle = document.getElementById('autosave-video-toggle');
const autosaveVideoState = document.getElementById('autosave-video-state');
const gridToggle = document.getElementById('grid-toggle');
const gridState = document.getElementById('grid-state');
const soundToggle = document.getElementById('sound-toggle');
const soundState = document.getElementById('sound-state');
const mirrorToggle = document.getElementById('mirror-toggle');
const mirrorState = document.getElementById('mirror-state');
const trayInstallBtn = document.getElementById('tray-install-btn');
const trayInstallState = document.getElementById('tray-install-state');

// Bottom Controls
const modeSelector = document.getElementById('mode-selector');
const shutterBtn = document.getElementById('shutter-btn');
const flipBtn = document.getElementById('flip-btn');
const galleryThumb = document.getElementById('gallery-thumb');
const thumbImg = document.getElementById('thumb-img');
const thumbIcon = document.getElementById('thumb-icon');
const thumbCount = document.getElementById('thumb-count');

// Modal Viewer Elements
const modal = document.getElementById('preview-modal');
const modalStillImg = document.getElementById('modal-still-img');
const modalMotionVideo = document.getElementById('modal-motion-video');
const modalLiveBadge = document.getElementById('modal-live-badge');
const modalBadgeText = document.getElementById('modal-badge-text');
const modalPhotoCounter = document.getElementById('modal-photo-counter');
const modalTimestamp = document.getElementById('modal-timestamp');
const playLiveBtn = document.getElementById('play-live-btn');
const gridGalleryBtn = document.getElementById('grid-gallery-btn');
const galleryGridView = document.getElementById('gallery-grid-view');
const modalPrevBtn = document.getElementById('modal-prev-btn');
const modalNextBtn = document.getElementById('modal-next-btn');
const holdHint = document.getElementById('hold-hint');
const interactiveArea = document.getElementById('interactive-area');
const modalFilmstrip = document.getElementById('modal-filmstrip');
const closeModalBtn = document.getElementById('close-modal-btn');
const downloadPhotoBtn = document.getElementById('download-photo-btn');
const downloadVideoBtn = document.getElementById('download-video-btn');
const deleteBtn = document.getElementById('delete-btn');
const shareBtn = document.getElementById('share-btn');

// Install Sheet
const installSheetBackdrop = document.getElementById('install-sheet-backdrop');
const installNativeBox = document.getElementById('install-native-box');
const installStatusMsg = document.getElementById('install-status-msg');
const btnTriggerInstall = document.getElementById('btn-trigger-install');
const btnCloseSheet = document.getElementById('btn-close-sheet');
const toastEl = document.getElementById('toast');

// ============================================================================
// 1. AUDIO & HAPTIC ENGINE (REAL CAMERA SOUND & VIBRATION)
// ============================================================================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
}

function triggerHaptic(ms = 18) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) {}
}

function playShutterSound() {
  triggerHaptic(25);
  if (!isSoundActive) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.065);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(2.0, now);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(now);
  } catch (e) {}
}

function playFocusSound() {
  triggerHaptic(10);
  if (!isSoundActive) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1950, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch (e) {}
}

function playVideoBeep(isStart = true) {
  triggerHaptic(isStart ? [20, 40, 20] : 30);
  if (!isSoundActive) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isStart ? 880 : 660, now);
    osc.frequency.exponentialRampToValueAtTime(isStart ? 1174 : 440, now + 0.11);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  } catch (e) {}
}

// --- Toast & Saved Badge ---
let toastTimer = null;
function showToast(message, duration = 2000) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

let savedBadgeTimer = null;
function showSavedBadge(text = '✓ Tersimpan di Galeri HP') {
  if (!savedBadge) return;
  savedBadge.textContent = text;
  savedBadge.classList.add('show');
  clearTimeout(savedBadgeTimer);
  savedBadgeTimer = setTimeout(() => {
    savedBadge.classList.remove('show');
  }, 2000);
}

// ============================================================================
// 2. PWA INSTALLATION & STANDALONE DETECTION
// ============================================================================
function isRunningStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

function updateInstallUI() {
  const standalone = isRunningStandalone();
  if (standalone) {
    if (installBtn) installBtn.classList.add('installed');
    if (trayInstallState) trayInstallState.textContent = 'TERPASANG';
  } else {
    if (installBtn) installBtn.classList.remove('installed');
    if (deferredInstallPrompt && installNativeBox) {
      installNativeBox.style.display = 'block';
    }
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallUI();
  if (installNativeBox) installNativeBox.style.display = 'block';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallUI();
  if (installSheetBackdrop) installSheetBackdrop.classList.remove('active');
  showToast('🎉 Kamera Foto-Live berhasil diinstal di HP Anda!');
});

async function triggerPWAInstall() {
  if (isRunningStandalone()) {
    showToast('✓ Aplikasi sudah terinstal & berjalan layar penuh');
    return;
  }

  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('📲 Menginstal Kamera Foto-Live ke layar utama...');
        if (installSheetBackdrop) installSheetBackdrop.classList.remove('active');
      }
      deferredInstallPrompt = null;
      updateInstallUI();
      return;
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  }

  if (installNativeBox) {
    installNativeBox.style.display = deferredInstallPrompt ? 'block' : 'none';
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS && installStatusMsg) {
    installStatusMsg.textContent = 'Di iPhone/iPad: Ketuk ikon Bagikan (Share) di bawah Safari, lalu pilih "Tambah ke Layar Utama" (Add to Home Screen).';
  }
  if (installSheetBackdrop) {
    installSheetBackdrop.classList.add('active');
  }
}

if (installBtn) installBtn.addEventListener('click', triggerPWAInstall);
if (trayInstallBtn) {
  trayInstallBtn.addEventListener('click', () => {
    settingsTray.classList.remove('active');
    triggerPWAInstall();
  });
}
if (btnTriggerInstall) btnTriggerInstall.addEventListener('click', triggerPWAInstall);
if (btnCloseSheet) {
  btnCloseSheet.addEventListener('click', () => {
    installSheetBackdrop.classList.remove('active');
  });
}
if (installSheetBackdrop) {
  installSheetBackdrop.addEventListener('click', (e) => {
    if (e.target === installSheetBackdrop) installSheetBackdrop.classList.remove('active');
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.update();
    }).catch((err) => console.warn('SW error:', err));
  });
}

// ============================================================================
// 3. MULTI-LENS DETECTION & REAL HARDWARE CAMERA STREAMING
// ============================================================================
async function detectCameraLenses() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    const backLenses = videoInputs.filter(d => {
      const lbl = (d.label || '').toLowerCase();
      return lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment') || lbl.includes('belakang');
    });

    availableRearDevices = backLenses.length > 0 ? backLenses : videoInputs;

    for (const dev of availableRearDevices) {
      const lbl = (dev.label || '').toLowerCase();
      if (lbl.includes('ultra') || lbl.includes('0.5') || lbl.includes('0.6') || lbl.includes('wide-angle') || lbl.includes('uw')) {
        ultraWideDeviceId = dev.deviceId;
      } else if (lbl.includes('tele') || lbl.includes('2x') || lbl.includes('zoom')) {
        teleRearDeviceId = dev.deviceId;
      } else if (!mainRearDeviceId) {
        mainRearDeviceId = dev.deviceId;
      }
    }

    // On many Android phones (Xiaomi/Poco/Samsung), camera2 back lenses are ordered: [0]=Main 1x, [1 or 2]=Ultra-Wide 0.5x
    if (!ultraWideDeviceId && backLenses.length >= 2) {
      mainRearDeviceId = backLenses[0].deviceId;
      ultraWideDeviceId = backLenses[backLenses.length - 1].deviceId;
    }
  } catch (e) {
    console.warn('Lens detection error:', e);
  }
}

async function startCamera(preferredDeviceId = null) {
  stopSimulationCanvas();
  if (permOverlay) permOverlay.style.display = 'none';

  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraPermissionError('Browser ini memerlukan koneksi HTTPS atau localhost untuk mengakses kamera fisik.');
    return;
  }

  const videoConstraintBase = preferredDeviceId
    ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
    : { facingMode: { ideal: currentFacingMode }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };

  // Try with audio first (for Live Photo & Video sound), fallback to video-only if mic denied
  const constraintCandidates = [
    { video: videoConstraintBase, audio: true },
    { video: videoConstraintBase, audio: false },
    { video: { facingMode: currentFacingMode }, audio: false },
    { video: true, audio: false }
  ];

  let stream = null;
  let lastError = null;

  for (const constraints of constraintCandidates) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream) break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!stream) {
    console.warn('Camera access failed:', lastError);
    showCameraPermissionError('Pastikan izin Kamera sudah diizinkan di pengaturan browser Anda.');
    return;
  }

  currentStream = stream;
  isSimulationMode = false;
  simCanvas.style.display = 'none';
  videoEl.style.display = 'block';
  videoEl.srcObject = stream;
  videoEl.muted = true; // Keep preview muted to prevent speaker echo

  // Detect available lenses once permission is granted
  await detectCameraLenses();

  // Check if active track supports hardware sub-1x zoom (e.g. zoom: 0.5)
  hwSupportsSub1x = false;
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
    activeDeviceId = settings.deviceId || preferredDeviceId;
    if (videoTrack.getCapabilities) {
      try {
        const caps = videoTrack.getCapabilities();
        if (caps.zoom && caps.zoom.min < 1.0) {
          hwSupportsSub1x = true;
        }
      } catch (e) {}
    }
  }

  await applyHardwareAndDigitalZoom(currentZoom);

  try {
    await videoEl.play();
  } catch (e) {}

  if (flashMode === 'torch') {
    setHardwareTorch(true);
  }
}

function showCameraPermissionError(msg) {
  if (permDesc && msg) permDesc.textContent = msg;
  if (permOverlay) permOverlay.style.display = 'flex';
}

if (btnRetryCamera) btnRetryCamera.addEventListener('click', () => startCamera());
if (btnSimCamera) btnSimCamera.addEventListener('click', () => startSimulationCamera());

// Live Interactive Simulation Camera (fallback for PC without webcam)
function startSimulationCamera() {
  if (permOverlay) permOverlay.style.display = 'none';
  isSimulationMode = true;
  videoEl.style.display = 'none';
  simCanvas.style.display = 'block';
  simCanvas.width = 1080;
  simCanvas.height = 1920;
  const ctx = simCanvas.getContext('2d');

  let start = performance.now();
  function renderSim(now) {
    if (!isSimulationMode) return;
    const t = (now - start) / 1000;

    const grad = ctx.createLinearGradient(0, 0, 0, simCanvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.55, '#1e293b');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, simCanvas.width, simCanvas.height);

    for (let i = 0; i < 14; i++) {
      const x = (simCanvas.width * 0.5) + Math.sin(t * 0.7 + i * 1.4) * 380;
      const y = (simCanvas.height * 0.45) + Math.cos(t * 0.5 + i * 1.1) * 520;
      const r = 45 + (i % 4) * 35;
      const orbGrad = ctx.createRadialGradient(x, y, 5, x, y, r);
      const colors = ['rgba(255, 200, 80, 0.35)', 'rgba(56, 189, 248, 0.3)', 'rgba(244, 114, 182, 0.28)'];
      orbGrad.addColorStop(0, colors[i % colors.length]);
      orbGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(simCanvas.width / 2, simCanvas.height / 2 + Math.sin(t * 2.2) * 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = 'rgba(255, 208, 0, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-260, -160, 520, 320, 28);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd000';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('● LIVE CAMERA SENSOR', 0, -55);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px monospace';
    ctx.fillText(new Date().toLocaleTimeString('id-ID'), 0, 30);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '26px sans-serif';
    ctx.fillText(`${aspectRatio.toUpperCase()} • ${currentZoom}x • EV ${currentExposure >= 0 ? '+' : ''}${currentExposure}`, 0, 105);
    ctx.restore();

    simAnimFrame = requestAnimationFrame(renderSim);
  }
  simAnimFrame = requestAnimationFrame(renderSim);
  applyVideoTransformAndFilter();
}

function stopSimulationCanvas() {
  isSimulationMode = false;
  if (simAnimFrame) {
    cancelAnimationFrame(simAnimFrame);
    simAnimFrame = null;
  }
}

// ============================================================================
// 4. 0.5x ULTRA-WIDE, 1x WIDE, & 2x TELEPHOTO ZOOM ENGINE
// ============================================================================

// Computes the effective visual/crop scale for the current zoom (0.5, 1, 2)
function getEffectiveSensorScale(zoomVal = currentZoom) {
  if (hwSupportsSub1x) {
    // Hardware handles 0.5x..2x directly; only apply extra scale if beyond hardware max
    return Math.max(1, zoomVal);
  }
  if (currentFacingMode === 'environment' && ultraWideDeviceId && activeDeviceId === ultraWideDeviceId && zoomVal < 1) {
    // Physical ultra-wide lens is active! Use 1.0 full wide sensor readout
    return 1.0;
  }
  // Universal calibrated sensor scaling:
  // 0.5x -> 1.00 (Full Wide Sensor - widest possible field of view!)
  // 1.0x -> 1.32 (Standard 1x camera framing)
  // 2.0x -> 2.64 (2x Telephoto framing)
  if (zoomVal < 1) {
    const t = Math.max(0, (zoomVal - 0.5) / 0.5); // 0 at 0.5x, 1 at 1.0x
    return 1.0 + t * (BASE_1X_SENSOR_FACTOR - 1.0);
  }
  return BASE_1X_SENSOR_FACTOR * zoomVal;
}

function applyVideoTransformAndFilter() {
  const targetEl = isSimulationMode ? simCanvas : videoEl;
  if (!targetEl) return;

  const shouldMirror = !isSimulationMode && currentFacingMode === 'user' && isMirrorSelfie;
  const mirrorScale = shouldMirror ? -1 : 1;
  const visualScale = getEffectiveSensorScale(currentZoom);

  targetEl.style.transform = `scale(${mirrorScale * visualScale}, ${visualScale})`;

  const baseFilter = FILTER_MAP[activeFilter] === 'none' ? '' : FILTER_MAP[activeFilter];
  const evBrightness = currentExposure !== 0 ? `brightness(${1 + currentExposure * 0.18})` : '';
  const combined = `${baseFilter} ${evBrightness}`.trim() || 'none';
  targetEl.style.filter = combined;
}

async function applyHardwareAndDigitalZoom(zoomLevel) {
  if (currentStream) {
    const track = currentStream.getVideoTracks()[0];
    if (track && track.getCapabilities) {
      try {
        const caps = track.getCapabilities();
        if (caps.zoom) {
          let targetHwZoom = zoomLevel;
          if (!hwSupportsSub1x && zoomLevel < 1) {
            targetHwZoom = caps.zoom.min || 1;
          }
          const clampedHw = Math.max(caps.zoom.min, Math.min(caps.zoom.max, targetHwZoom));
          await track.applyConstraints({ advanced: [{ zoom: clampedHw }] });
        }
      } catch (e) {}
    }
  }
  applyVideoTransformAndFilter();
}

const zoomBtns = document.querySelectorAll('.zoom-btn');
zoomBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const z = parseFloat(btn.dataset.zoom) || 1;
    setCameraZoom(z);
  });
});

async function setCameraZoom(zoomLevel) {
  const prevZoom = currentZoom;
  currentZoom = Math.max(0.5, Math.min(4, zoomLevel));
  triggerHaptic(14);

  // Update 0.5 / 1x / 2 button UI
  zoomBtns.forEach(b => {
    const bz = parseFloat(b.dataset.zoom);
    const isMatched =
      (bz === 0.5 && currentZoom < 0.85) ||
      (bz === 1 && currentZoom >= 0.85 && currentZoom < 1.6) ||
      (bz === 2 && currentZoom >= 1.6);

    b.classList.toggle('active', isMatched);
    if (isMatched) {
      const labelNum = Math.abs(currentZoom - bz) < 0.1 ? bz : currentZoom.toFixed(1).replace('.0', '');
      b.innerHTML = `${labelNum}<span>x</span>`;
    } else {
      b.textContent = bz;
    }
  });

  // If switching between 0.5x and >=1x on rear camera and a dedicated Ultra-Wide lens exists (and hw zoom doesn't support <1x)
  if (
    !isRecordingVideo &&
    !isSimulationMode &&
    currentFacingMode === 'environment' &&
    !hwSupportsSub1x &&
    ultraWideDeviceId &&
    mainRearDeviceId &&
    ultraWideDeviceId !== mainRearDeviceId
  ) {
    if (currentZoom < 1 && activeDeviceId !== ultraWideDeviceId) {
      viewfinderFrame.classList.add('camera-switching');
      await startCamera(ultraWideDeviceId);
      setTimeout(() => viewfinderFrame.classList.remove('camera-switching'), 180);
      showToast('Lensa Ultra-Wide 0.5x', 1100);
      return;
    } else if (currentZoom >= 1 && prevZoom < 1 && activeDeviceId === ultraWideDeviceId) {
      viewfinderFrame.classList.add('camera-switching');
      await startCamera(mainRearDeviceId);
      setTimeout(() => viewfinderFrame.classList.remove('camera-switching'), 180);
    }
  }

  await applyHardwareAndDigitalZoom(currentZoom);

  if (currentZoom === 0.5) {
    showToast('0.5x Ultra-Wide', 1000);
  } else if (currentZoom === 1) {
    showToast('1x Wide', 1000);
  } else if (currentZoom === 2) {
    showToast('2x Telephoto', 1000);
  } else {
    showToast(`Zoom ${currentZoom.toFixed(1).replace('.0', '')}x`, 900);
  }
}

// Pinch-to-Zoom on Viewfinder (0.5x to 4.0x)
let initialPinchDistance = null;
let initialZoom = 1;

viewfinderFrame.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    initialPinchDistance = Math.hypot(dx, dy);
    initialZoom = currentZoom;
  }
}, { passive: true });

viewfinderFrame.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && initialPinchDistance) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / initialPinchDistance;
    const nextZoom = Math.round(Math.max(0.5, Math.min(4, initialZoom * ratio)) * 10) / 10;
    if (Math.abs(nextZoom - currentZoom) >= 0.1) {
      setCameraZoom(nextZoom);
    }
  }
}, { passive: true });

viewfinderFrame.addEventListener('touchend', () => {
  initialPinchDistance = null;
});

// ============================================================================
// 5. TAP-TO-FOCUS, EXPOSURE SLIDER, DOUBLE-TAP FLIP & SWIPE MODES
// ============================================================================
async function setHardwareTorch(enable) {
  if (!currentStream) return false;
  const track = currentStream.getVideoTracks()[0];
  if (!track || !track.getCapabilities) return false;
  try {
    const caps = track.getCapabilities();
    if (caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: enable }] });
      return true;
    }
  } catch (e) {}
  return false;
}

let focusHideTimer = null;
let lastTapTime = 0;
let touchStartX = 0;
let touchStartY = 0;

viewfinderFrame.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.exposure-control') || e.target.closest('.camera-permission-overlay')) {
    return;
  }

  touchStartX = e.clientX;
  touchStartY = e.clientY;

  // Double-tap on viewfinder flips camera (just like native camera apps)
  const now = Date.now();
  if (now - lastTapTime < 280) {
    flipBtn.click();
    lastTapTime = 0;
    return;
  }
  lastTapTime = now;

  settingsTray.classList.remove('active');

  const rect = viewfinderFrame.getBoundingClientRect();
  const x = Math.max(48, Math.min(rect.width - 80, e.clientX - rect.left));
  const y = Math.max(60, Math.min(rect.height - 60, e.clientY - rect.top));

  focusReticle.style.left = `${x}px`;
  focusReticle.style.top = `${y}px`;
  focusReticle.classList.remove('active');
  void focusReticle.offsetWidth;
  focusReticle.classList.add('active');

  playFocusSound();

  if (currentStream) {
    const track = currentStream.getVideoTracks()[0];
    if (track && track.getCapabilities) {
      try {
        const caps = track.getCapabilities();
        if (caps.focusMode && caps.focusMode.includes('single-shot')) {
          track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] }).catch(() => {});
        }
      } catch (err) {}
    }
  }

  resetFocusHideTimer();
});

// Swipe Left / Right on Viewfinder to Switch Camera Modes
const MODE_LIST = ['portrait', 'photo', 'live', 'video'];
viewfinderFrame.addEventListener('pointerup', (e) => {
  if (isRecordingVideo || initialPinchDistance) return;
  const dx = e.clientX - touchStartX;
  const dy = e.clientY - touchStartY;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.8) {
    const curIdx = MODE_LIST.indexOf(cameraMode);
    if (dx < 0 && curIdx < MODE_LIST.length - 1) {
      setCameraMode(MODE_LIST[curIdx + 1]);
    } else if (dx > 0 && curIdx > 0) {
      setCameraMode(MODE_LIST[curIdx - 1]);
    }
  }
});

function resetFocusHideTimer() {
  clearTimeout(focusHideTimer);
  focusHideTimer = setTimeout(() => {
    focusReticle.classList.remove('active');
  }, 3500);
}

if (exposureSlider) {
  exposureSlider.addEventListener('input', (e) => {
    currentExposure = parseFloat(e.target.value) || 0;
    applyVideoTransformAndFilter();
    resetFocusHideTimer();

    if (currentStream) {
      const track = currentStream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        try {
          const caps = track.getCapabilities();
          if (caps.exposureCompensation) {
            const min = caps.exposureCompensation.min || -2;
            const max = caps.exposureCompensation.max || 2;
            const clamped = Math.max(min, Math.min(max, currentExposure));
            track.applyConstraints({ advanced: [{ exposureCompensation: clamped }] }).catch(() => {});
          }
        } catch (err) {}
      }
    }
  });
}

// ============================================================================
// 6. TOP BAR & QUICK SETTINGS CONTROLS
// ============================================================================
flashToggle.addEventListener('click', () => {
  triggerHaptic(15);
  if (flashMode === 'off') {
    flashMode = 'auto';
    flashBadge.textContent = 'AUTO';
    flashToggle.classList.add('active');
    setHardwareTorch(false);
    showToast('⚡ Flash Otomatis');
  } else if (flashMode === 'auto') {
    flashMode = 'on';
    flashBadge.textContent = 'ON';
    flashToggle.classList.add('active');
    setHardwareTorch(false);
    showToast('⚡ Flash Selalu Aktif');
  } else if (flashMode === 'on') {
    flashMode = 'torch';
    flashBadge.textContent = 'SENTER';
    flashToggle.classList.add('active');
    setHardwareTorch(true);
    showToast('🔦 Senter Kamera Aktif');
  } else {
    flashMode = 'off';
    flashBadge.textContent = 'OFF';
    flashToggle.classList.remove('active');
    setHardwareTorch(false);
    showToast('Flash Mati');
  }
});

liveToggle.addEventListener('click', () => {
  triggerHaptic(18);
  isLiveActive = !isLiveActive;
  updateLiveUI();
  showToast(isLiveActive ? '◎ Live Photo Aktif (Rekam Gerak)' : 'Live Photo Nonaktif (Foto Standar)');
});

function updateLiveUI() {
  liveToggle.classList.toggle('active', isLiveActive);
  liveToggle.classList.toggle('off', !isLiveActive);
  liveStatusText.textContent = isLiveActive ? 'LIVE' : 'OFF';
  if (cameraMode !== 'video') {
    shutterBtn.classList.toggle('live-active', isLiveActive);
  }
}

timerToggle.addEventListener('click', () => {
  triggerHaptic(15);
  if (timerSeconds === 0) {
    timerSeconds = 3;
    timerBadge.textContent = '3s';
    timerToggle.classList.add('active');
    showToast('⏱️ Timer 3 Detik');
  } else if (timerSeconds === 3) {
    timerSeconds = 10;
    timerBadge.textContent = '10s';
    timerToggle.classList.add('active');
    showToast('⏱️ Timer 10 Detik');
  } else {
    timerSeconds = 0;
    timerBadge.textContent = '';
    timerToggle.classList.remove('active');
    showToast('Timer Mati');
  }
});

const RATIOS = ['full', '4:3', '16:9', '1:1'];
ratioToggle.addEventListener('click', () => {
  triggerHaptic(15);
  const idx = (RATIOS.indexOf(aspectRatio) + 1) % RATIOS.length;
  aspectRatio = RATIOS[idx];
  ratioText.textContent = aspectRatio.toUpperCase();

  viewfinderFrame.className = 'viewfinder-frame';
  if (aspectRatio === 'full') viewfinderFrame.classList.add('ratio-full');
  else if (aspectRatio === '4:3') viewfinderFrame.classList.add('ratio-4-3');
  else if (aspectRatio === '16:9') viewfinderFrame.classList.add('ratio-16-9');
  else if (aspectRatio === '1:1') viewfinderFrame.classList.add('ratio-1-1');

  showToast(`Rasio Layar ${aspectRatio.toUpperCase()}`, 1200);
});

filterToggle.addEventListener('click', () => {
  triggerHaptic(15);
  filterStrip.classList.toggle('active');
  filterToggle.classList.toggle('active', filterStrip.classList.contains('active') || activeFilter !== 'none');
});

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    triggerHaptic(12);
    activeFilter = chip.dataset.filter || 'none';
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c === chip));
    filterToggle.classList.toggle('active', activeFilter !== 'none');
    applyVideoTransformAndFilter();
    showToast(`Filter: ${chip.textContent}`, 1200);
  });
});

settingsToggle.addEventListener('click', () => {
  triggerHaptic(15);
  settingsTray.classList.toggle('active');
});

if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener('click', () => {
    settingsTray.classList.remove('active');
  });
}

function syncSettingsTrayUI() {
  if (autosaveToggle) {
    autosaveToggle.classList.toggle('active', isAutoSaveActive);
    autosaveState.textContent = isAutoSaveActive ? 'AKTIF' : 'OFF';
  }
  if (autosaveVideoToggle) {
    autosaveVideoToggle.classList.toggle('active', isAutoSaveVideoClip);
    autosaveVideoState.textContent = isAutoSaveVideoClip ? 'AKTIF' : 'OFF';
  }
  if (gridToggle) {
    gridToggle.classList.toggle('active', isGridActive);
    gridState.textContent = isGridActive ? 'AKTIF' : 'OFF';
    gridOverlay.classList.toggle('active', isGridActive);
  }
  if (soundToggle) {
    soundToggle.classList.toggle('active', isSoundActive);
    soundState.textContent = isSoundActive ? 'AKTIF' : 'OFF';
  }
  if (mirrorToggle) {
    mirrorToggle.classList.toggle('active', isMirrorSelfie);
    mirrorState.textContent = isMirrorSelfie ? 'AKTIF' : 'OFF';
  }
}

if (autosaveToggle) {
  autosaveToggle.addEventListener('click', () => {
    isAutoSaveActive = !isAutoSaveActive;
    localStorage.setItem('fotolive_autosave', isAutoSaveActive ? 'true' : 'false');
    syncSettingsTrayUI();
    showToast(isAutoSaveActive ? '💾 Simpan Otomatis ke Galeri HP: AKTIF' : 'Simpan Otomatis ke Galeri HP: NONAKTIF');
  });
}

if (autosaveVideoToggle) {
  autosaveVideoToggle.addEventListener('click', () => {
    isAutoSaveVideoClip = !isAutoSaveVideoClip;
    localStorage.setItem('fotolive_autosave_clip', isAutoSaveVideoClip ? 'true' : 'false');
    syncSettingsTrayUI();
    showToast(isAutoSaveVideoClip ? '🎬 Unduh Otomatis Klip Live MP4: AKTIF' : 'Unduh Otomatis Klip Live: OFF (Hanya Foto JPG)');
  });
}

if (gridToggle) {
  gridToggle.addEventListener('click', () => {
    isGridActive = !isGridActive;
    localStorage.setItem('fotolive_grid', isGridActive ? 'true' : 'false');
    syncSettingsTrayUI();
  });
}

if (soundToggle) {
  soundToggle.addEventListener('click', () => {
    isSoundActive = !isSoundActive;
    localStorage.setItem('fotolive_sound', isSoundActive ? 'true' : 'false');
    syncSettingsTrayUI();
    showToast(isSoundActive ? '🔊 Suara Rana Kamera Aktif' : '🔇 Suara Kamera Dibisukan');
  });
}

if (mirrorToggle) {
  mirrorToggle.addEventListener('click', () => {
    isMirrorSelfie = !isMirrorSelfie;
    localStorage.setItem('fotolive_mirror', isMirrorSelfie ? 'true' : 'false');
    syncSettingsTrayUI();
    applyVideoTransformAndFilter();
  });
}

// ============================================================================
// 7. CAMERA MODES (POTRET | FOTO | LIVE FOTO | VIDEO) & FLIP CAMERA
// ============================================================================
document.querySelectorAll('.mode-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRecordingVideo) return;
    setCameraMode(btn.dataset.mode);
  });
});

function setCameraMode(mode) {
  cameraMode = mode;
  triggerHaptic(15);

  document.querySelectorAll('.mode-item').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });

  portraitVignette.classList.toggle('active', mode === 'portrait');

  if (mode === 'live') {
    isLiveActive = true;
    liveToggle.style.display = 'inline-flex';
    shutterBtn.classList.remove('video-mode');
    updateLiveUI();
    showToast('Mode LIVE FOTO ◎', 1100);
  } else if (mode === 'photo' || mode === 'portrait') {
    isLiveActive = false;
    liveToggle.style.display = 'inline-flex';
    shutterBtn.classList.remove('video-mode');
    updateLiveUI();
    showToast(mode === 'portrait' ? 'Mode POTRET' : 'Mode FOTO', 1100);
  } else if (mode === 'video') {
    liveToggle.style.display = 'none';
    shutterBtn.classList.remove('live-active');
    shutterBtn.classList.add('video-mode');
    showToast('Mode VIDEO HD', 1100);
  }
}

// Flip Front / Rear Camera with realistic blur transition
flipBtn.addEventListener('click', async () => {
  if (isRecordingVideo) return;
  triggerHaptic(20);
  flipBtn.classList.add('flipping');
  viewfinderFrame.classList.add('camera-switching');

  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  await startCamera();

  setTimeout(() => {
    flipBtn.classList.remove('flipping');
    viewfinderFrame.classList.remove('camera-switching');
  }, 240);

  showToast(currentFacingMode === 'user' ? '🤳 Kamera Depan' : '📷 Kamera Belakang', 1400);
});

// ============================================================================
// 8. CAPTURE ENGINE (STILL PHOTO, LIVE PHOTO, & FULL HD VIDEO)
// ============================================================================
shutterBtn.addEventListener('click', () => {
  if (cameraMode === 'video') {
    toggleFullVideoRecording();
    return;
  }

  if (isCapturing) return;

  if (timerSeconds > 0) {
    runCountdown(timerSeconds, () => executePhotoCapture());
  } else {
    executePhotoCapture();
  }
});

window.addEventListener('keydown', (e) => {
  if (modal.classList.contains('active')) return;
  if (e.code === 'Space' || e.code === 'Enter' || e.key === 'AudioVolumeUp' || e.key === 'AudioVolumeDown') {
    e.preventDefault();
    shutterBtn.click();
  }
});

function runCountdown(seconds, callback) {
  isCapturing = true;
  let count = seconds;
  countdownOverlay.classList.add('active');
  countdownNumber.textContent = count;
  playFocusSound();

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNumber.textContent = count;
      playFocusSound();
    } else {
      clearInterval(interval);
      countdownOverlay.classList.remove('active');
      isCapturing = false;
      callback();
    }
  }, 1000);
}

function getCameraDCIMName(prefix = 'IMG', ext = 'jpg') {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const timePart = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${prefix}_${datePart}_${timePart}.${ext}`;
}

async function executePhotoCapture() {
  isCapturing = true;
  shutterBtn.classList.add('pressing');
  playShutterSound();

  const shouldFlash = flashMode === 'on' || (flashMode === 'auto' && currentFacingMode === 'user');
  if (shouldFlash) {
    if (currentFacingMode === 'environment') {
      await setHardwareTorch(true);
    }
    flashScreen.classList.add('trigger');
    setTimeout(() => {
      flashScreen.classList.remove('trigger');
      if (flashMode !== 'torch') setHardwareTorch(false);
    }, 160);
  }

  // --- 1. Capture High-Resolution Still Photo Immediately (with active 0.5x/1x/2x zoom & filter) ---
  const stillBlob = await captureHighResStillBlob();
  const itemId = Date.now();
  const filename = getCameraDCIMName('IMG', 'jpg');
  const photoUrl = URL.createObjectURL(stillBlob);

  const newItem = {
    id: itemId,
    filename: filename,
    timestamp: new Date().toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
    photoBlob: stillBlob,
    photoUrl: photoUrl,
    videoBlob: null,
    videoUrl: null,
    videoExt: 'mp4',
    isLive: isLiveActive,
    isVideoOnly: false
  };

  galleryItems.unshift(newItem);
  activeItemIndex = 0;

  // --- 2. IMMEDIATE AUTO-SAVE TO DEVICE GALLERY (Synchronous within user gesture!) ---
  if (isAutoSaveActive) {
    triggerDeviceDownload(photoUrl, filename);
    showSavedBadge(isLiveActive ? '✓ Live Foto Tersimpan ke Galeri' : '✓ Foto Tersimpan ke Galeri');
  }

  savePhotoToDB(newItem);
  updateBottomThumbnailUI();

  setTimeout(() => shutterBtn.classList.remove('pressing'), 150);

  // --- 3. Record 1.5s Live Motion Clip (matching zoom, mirror & filter!) ---
  if (isLiveActive) {
    recordingHudText.textContent = 'LIVE';
    recordingHud.classList.add('active');

    try {
      const motionResult = await recordProcessedMotionClip(1500);
      if (motionResult && motionResult.blob && motionResult.blob.size > 0) {
        newItem.videoBlob = motionResult.blob;
        newItem.videoUrl = URL.createObjectURL(motionResult.blob);
        newItem.videoExt = motionResult.ext;

        savePhotoToDB(newItem);

        if (isAutoSaveActive && isAutoSaveVideoClip) {
          const vidName = getCameraDCIMName('LIVE', motionResult.ext);
          triggerDeviceDownload(newItem.videoUrl, vidName);
        }
      }
    } catch (err) {
      console.warn('Live motion recording error:', err);
    }

    recordingHud.classList.remove('active');
  }

  isCapturing = false;
}

// Helper to draw a frame with the exact active 0.5x / 1x / 2x zoom, aspect ratio, mirror, and filter
function drawCameraFrameToCanvas(ctx, destW, destH) {
  const sourceEl = isSimulationMode ? simCanvas : videoEl;
  const srcW = isSimulationMode ? simCanvas.width : (videoEl.videoWidth || 1280);
  const srcH = isSimulationMode ? simCanvas.height : (videoEl.videoHeight || 720);

  const targetRatio = destW / destH;
  let baseCropW = srcW;
  let baseCropH = srcH;
  if (srcW / srcH > targetRatio) {
    baseCropW = Math.round(srcH * targetRatio);
  } else {
    baseCropH = Math.round(srcW / targetRatio);
  }

  const effectiveScale = getEffectiveSensorScale(currentZoom);
  const zoomedW = Math.round(baseCropW / effectiveScale);
  const zoomedH = Math.round(baseCropH / effectiveScale);
  const sx = Math.round((srcW - zoomedW) / 2);
  const sy = Math.round((srcH - zoomedH) / 2);

  ctx.save();
  const baseFilter = FILTER_MAP[activeFilter] === 'none' ? '' : FILTER_MAP[activeFilter];
  const evBrightness = currentExposure !== 0 ? `brightness(${1 + currentExposure * 0.18})` : '';
  const combinedFilter = `${baseFilter} ${evBrightness}`.trim();
  if (combinedFilter) {
    ctx.filter = combinedFilter;
  }

  if (!isSimulationMode && currentFacingMode === 'user' && isMirrorSelfie) {
    ctx.translate(destW, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(sourceEl, sx, sy, zoomedW, zoomedH, 0, 0, destW, destH);
  ctx.restore();

  if (cameraMode === 'portrait') {
    const grad = ctx.createRadialGradient(
      destW / 2, destH / 2, Math.min(destW, destH) * 0.3,
      destW / 2, destH / 2, Math.max(destW, destH) * 0.7
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, destW, destH);
  }
}

function getOutputDimensions() {
  const srcW = isSimulationMode ? simCanvas.width : (videoEl.videoWidth || 1920);
  const srcH = isSimulationMode ? simCanvas.height : (videoEl.videoHeight || 1080);

  let targetRatio = srcW / srcH;
  if (aspectRatio === '4:3') targetRatio = srcH > srcW ? 3 / 4 : 4 / 3;
  else if (aspectRatio === '16:9') targetRatio = srcH > srcW ? 9 / 16 : 16 / 9;
  else if (aspectRatio === '1:1') targetRatio = 1;

  let outW = srcW;
  let outH = srcH;
  if (srcW / srcH > targetRatio) {
    outW = Math.round(srcH * targetRatio);
  } else {
    outH = Math.round(srcW / targetRatio);
  }
  return { outW, outH };
}

function captureHighResStillBlob() {
  return new Promise((resolve) => {
    const { outW, outH } = getOutputDimensions();
    captureCanvas.width = outW;
    captureCanvas.height = outH;
    const ctx = captureCanvas.getContext('2d');
    drawCameraFrameToCanvas(ctx, outW, outH);
    captureCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
  });
}

function getSupportedVideoMime() {
  const candidates = [
    { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' }
  ];

  for (const c of candidates) {
    try {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(c.mime)) {
        return c;
      }
    } catch (e) {}
  }
  return { mime: '', ext: 'mp4' };
}

// Records Live Motion Clip through a processed canvas stream so 0.5x/1x/2x zoom, mirror & filter match the still photo!
function recordProcessedMotionClip(durationMs = 1500) {
  return new Promise((resolve) => {
    if (!window.MediaRecorder) {
      resolve(null);
      return;
    }

    const { outW, outH } = getOutputDimensions();
    const scaleDown = Math.min(1, 720 / Math.min(outW, outH));
    const recCanvas = document.createElement('canvas');
    recCanvas.width = Math.round(outW * scaleDown);
    recCanvas.height = Math.round(outH * scaleDown);
    const rCtx = recCanvas.getContext('2d');

    let active = true;
    function renderLoop() {
      if (!active) return;
      drawCameraFrameToCanvas(rCtx, recCanvas.width, recCanvas.height);
      requestAnimationFrame(renderLoop);
    }
    renderLoop();

    const canvasStream = recCanvas.captureStream(30);
    // Attach real microphone audio track if available
    if (currentStream) {
      const audioTracks = currentStream.getAudioTracks();
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
      }
    }

    const { mime, ext } = getSupportedVideoMime();
    const chunks = [];
    let recorder = null;

    try {
      recorder = mime ? new MediaRecorder(canvasStream, { mimeType: mime }) : new MediaRecorder(canvasStream);
    } catch (e) {
      try {
        recorder = new MediaRecorder(canvasStream);
      } catch (err) {
        active = false;
        resolve(null);
        return;
      }
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      active = false;
      const blob = new Blob(chunks, { type: mime || 'video/mp4' });
      resolve({ blob, ext });
    };

    recorder.start();
    setTimeout(() => {
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, durationMs);
  });
}

// ============================================================================
// 9. FULL VIDEO RECORDING MODE
// ============================================================================
let videoRenderLoopActive = false;

async function toggleFullVideoRecording() {
  if (!isRecordingVideo) {
    if (!window.MediaRecorder) {
      showToast('Perekaman video tidak didukung di perangkat ini');
      return;
    }

    const { outW, outH } = getOutputDimensions();
    const scaleDown = Math.min(1, 1080 / Math.max(outW, outH));
    const recCanvas = document.createElement('canvas');
    recCanvas.width = Math.round(outW * scaleDown);
    recCanvas.height = Math.round(outH * scaleDown);
    const rCtx = recCanvas.getContext('2d');

    videoRenderLoopActive = true;
    function renderVideoFrame() {
      if (!videoRenderLoopActive) return;
      drawCameraFrameToCanvas(rCtx, recCanvas.width, recCanvas.height);
      requestAnimationFrame(renderVideoFrame);
    }
    renderVideoFrame();

    const streamToRecord = recCanvas.captureStream(30);
    if (currentStream) {
      const audioTracks = currentStream.getAudioTracks();
      if (audioTracks.length > 0) {
        streamToRecord.addTrack(audioTracks[0]);
      }
    }

    const { mime, ext } = getSupportedVideoMime();
    videoRecordedChunks = [];

    try {
      videoMediaRecorder = mime
        ? new MediaRecorder(streamToRecord, { mimeType: mime })
        : new MediaRecorder(streamToRecord);
    } catch (e) {
      videoMediaRecorder = new MediaRecorder(streamToRecord);
    }

    videoMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) videoRecordedChunks.push(e.data);
    };

    const videoThumbBlob = await captureHighResStillBlob();

    videoMediaRecorder.onstop = () => {
      videoRenderLoopActive = false;
      const videoBlob = new Blob(videoRecordedChunks, { type: mime || 'video/mp4' });
      const videoUrl = URL.createObjectURL(videoBlob);
      const thumbUrl = URL.createObjectURL(videoThumbBlob);
      const vidFilename = getCameraDCIMName('VID', ext);

      const vidItem = {
        id: Date.now(),
        filename: vidFilename,
        timestamp: new Date().toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
        photoBlob: videoThumbBlob,
        photoUrl: thumbUrl,
        videoBlob: videoBlob,
        videoUrl: videoUrl,
        videoExt: ext,
        isLive: true,
        isVideoOnly: true
      };

      galleryItems.unshift(vidItem);
      activeItemIndex = 0;
      savePhotoToDB(vidItem);
      updateBottomThumbnailUI();

      if (isAutoSaveActive) {
        triggerDeviceDownload(videoUrl, vidFilename);
        showSavedBadge('✓ Video Tersimpan ke Galeri HP');
      } else {
        showToast('✓ Video tersimpan di galeri aplikasi');
      }
    };

    videoMediaRecorder.start(250);
    isRecordingVideo = true;
    playVideoBeep(true);
    shutterBtn.classList.add('recording');

    videoStartTime = Date.now();
    videoTimerText.textContent = '00:00';
    videoTimerPill.style.display = 'inline-flex';
    if (installBtn) installBtn.style.display = 'none';

    videoTimerInterval = setInterval(() => {
      const secs = Math.floor((Date.now() - videoStartTime) / 1000);
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      videoTimerText.textContent = `${m}:${s}`;
    }, 500);
  } else {
    isRecordingVideo = false;
    videoRenderLoopActive = false;
    playVideoBeep(false);
    shutterBtn.classList.remove('recording');
    clearInterval(videoTimerInterval);
    videoTimerPill.style.display = 'none';
    if (installBtn && !isRunningStandalone()) {
      installBtn.style.display = 'inline-flex';
    }

    if (videoMediaRecorder && videoMediaRecorder.state !== 'inactive') {
      videoMediaRecorder.stop();
    }
  }
}

// ============================================================================
// 10. AUTO-SAVE TO DEVICE GALLERY & INDEXEDDB PERSISTENT STORAGE
// ============================================================================
function triggerDeviceDownload(blobUrl, filename) {
  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
    }, 1000);
  } catch (err) {
    console.warn('Download error:', err);
  }
}

function initDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve(null);
      return;
    }
    const req = indexedDB.open('FotoLiveDB', 2);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('photos')) {
        database.createObjectStore('photos', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = () => resolve(null);
  });
}

function savePhotoToDB(item) {
  if (!db) return;
  try {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').put({
      id: item.id,
      filename: item.filename,
      timestamp: item.timestamp,
      photoBlob: item.photoBlob,
      videoBlob: item.videoBlob,
      videoExt: item.videoExt || 'mp4',
      isLive: item.isLive,
      isVideoOnly: !!item.isVideoOnly
    });
  } catch (err) {
    console.warn('IndexedDB save error:', err);
  }
}

async function loadPhotosFromDB() {
  if (!db) await initDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('photos', 'readonly');
      const req = tx.objectStore('photos').getAll();
      req.onsuccess = () => {
        const rows = req.result || [];
        rows.sort((a, b) => b.id - a.id);
        galleryItems = rows
          .filter(r => r && r.photoBlob)
          .map(r => ({
            id: r.id,
            filename: r.filename || `IMG_${r.id}.jpg`,
            timestamp: r.timestamp || '',
            photoBlob: r.photoBlob,
            photoUrl: URL.createObjectURL(r.photoBlob),
            videoBlob: r.videoBlob || null,
            videoUrl: r.videoBlob ? URL.createObjectURL(r.videoBlob) : null,
            videoExt: r.videoExt || 'mp4',
            isLive: !!r.isLive,
            isVideoOnly: !!r.isVideoOnly
          }));
        updateBottomThumbnailUI(false);
        resolve();
      };
      req.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

function deletePhotoFromDB(id) {
  if (!db) return;
  try {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').delete(id);
  } catch (e) {}
}

function updateBottomThumbnailUI(animate = true) {
  if (galleryItems.length > 0) {
    thumbImg.src = galleryItems[0].photoUrl;
    thumbImg.style.display = 'block';
    if (thumbIcon) thumbIcon.style.display = 'none';
    thumbCount.textContent = galleryItems.length;
    thumbCount.style.display = 'block';
    if (animate) {
      galleryThumb.classList.remove('pop');
      void galleryThumb.offsetWidth;
      galleryThumb.classList.add('pop');
    }
  } else {
    thumbImg.src = '';
    thumbImg.style.display = 'none';
    if (thumbIcon) thumbIcon.style.display = 'flex';
    thumbCount.style.display = 'none';
  }
}

// ============================================================================
// 11. IN-APP CAMERA ROLL, GRID VIEW & INTERACTIVE LIVE PHOTO PLAYER
// ============================================================================
galleryThumb.addEventListener('click', () => {
  triggerHaptic(15);
  if (galleryItems.length === 0) {
    showToast('Belum ada foto — ketuk tombol rana untuk memotret!');
    return;
  }
  isGalleryGridOpen = false;
  if (galleryGridView) galleryGridView.style.display = 'none';
  interactiveArea.style.display = 'flex';
  openModalViewer(0);
});

if (gridGalleryBtn) {
  gridGalleryBtn.addEventListener('click', () => {
    triggerHaptic(12);
    isGalleryGridOpen = !isGalleryGridOpen;
    if (isGalleryGridOpen) {
      stopMotionPlayback();
      renderGalleryGridView();
      galleryGridView.style.display = 'grid';
      interactiveArea.style.display = 'none';
      gridGalleryBtn.textContent = '▢ Foto';
    } else {
      galleryGridView.style.display = 'none';
      interactiveArea.style.display = 'flex';
      gridGalleryBtn.textContent = '☷ Semua';
    }
  });
}

function renderGalleryGridView() {
  if (!galleryGridView) return;
  galleryGridView.innerHTML = '';
  galleryItems.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = `grid-photo-card ${idx === activeItemIndex ? 'active' : ''}`;
    const img = document.createElement('img');
    img.src = item.photoUrl;
    img.alt = 'Foto';
    card.appendChild(img);

    if (item.isVideoOnly || item.isLive) {
      const badge = document.createElement('span');
      badge.className = 'grid-card-badge';
      badge.textContent = item.isVideoOnly ? 'VIDEO' : 'LIVE';
      card.appendChild(badge);
    }

    card.addEventListener('click', () => {
      isGalleryGridOpen = false;
      galleryGridView.style.display = 'none';
      interactiveArea.style.display = 'flex';
      if (gridGalleryBtn) gridGalleryBtn.textContent = '☷ Semua';
      openModalViewer(idx);
    });
    galleryGridView.appendChild(card);
  });
}

function renderFilmstrip() {
  if (!modalFilmstrip) return;
  modalFilmstrip.innerHTML = '';
  galleryItems.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = `filmstrip-item ${idx === activeItemIndex ? 'active' : ''}`;
    const img = document.createElement('img');
    img.src = item.photoUrl;
    img.alt = 'Thumb';
    div.appendChild(img);
    div.addEventListener('click', () => openModalViewer(idx));
    modalFilmstrip.appendChild(div);
  });
}

function openModalViewer(index) {
  activeItemIndex = Math.max(0, Math.min(galleryItems.length - 1, index));
  const item = galleryItems[activeItemIndex];
  if (!item) return;

  stopMotionPlayback();

  modalStillImg.src = item.photoUrl;
  modalStillImg.style.display = 'block';
  modalPhotoCounter.textContent = `${activeItemIndex + 1} / ${galleryItems.length}`;
  if (modalTimestamp) modalTimestamp.textContent = item.timestamp || 'Tersimpan';

  if (item.isVideoOnly && item.videoUrl) {
    modalStillImg.style.display = 'none';
    modalMotionVideo.src = item.videoUrl;
    modalMotionVideo.style.display = 'block';
    modalMotionVideo.controls = true;
    modalMotionVideo.muted = false;
    modalLiveBadge.style.display = 'inline-flex';
    modalBadgeText.textContent = 'VIDEO';
    holdHint.style.display = 'none';
    if (playLiveBtn) playLiveBtn.style.display = 'none';
    downloadVideoBtn.style.display = 'inline-flex';
    modalMotionVideo.play().catch(() => {});
  } else if (item.isLive && item.videoUrl) {
    modalMotionVideo.src = item.videoUrl;
    modalMotionVideo.style.display = 'none';
    modalMotionVideo.controls = false;
    modalLiveBadge.style.display = 'inline-flex';
    modalBadgeText.textContent = 'LIVE';
    holdHint.style.display = 'flex';
    if (playLiveBtn) playLiveBtn.style.display = 'inline-flex';
    downloadVideoBtn.style.display = 'inline-flex';
  } else {
    modalMotionVideo.src = '';
    modalMotionVideo.style.display = 'none';
    modalLiveBadge.style.display = 'none';
    holdHint.style.display = 'none';
    if (playLiveBtn) playLiveBtn.style.display = 'none';
    downloadVideoBtn.style.display = 'none';
  }

  modalPrevBtn.classList.toggle('disabled', activeItemIndex >= galleryItems.length - 1);
  modalNextBtn.classList.toggle('disabled', activeItemIndex <= 0);

  renderFilmstrip();
  if (isGalleryGridOpen) renderGalleryGridView();

  downloadPhotoBtn.onclick = () => {
    triggerHaptic(15);
    triggerDeviceDownload(item.photoUrl, item.filename || getCameraDCIMName('IMG', 'jpg'));
    showToast('💾 Foto JPG disimpan ke Galeri HP');
  };

  downloadVideoBtn.onclick = () => {
    if (!item.videoUrl) return;
    triggerHaptic(15);
    const vName = getCameraDCIMName(item.isVideoOnly ? 'VID' : 'LIVE', item.videoExt || 'mp4');
    triggerDeviceDownload(item.videoUrl, vName);
    showToast('🎬 Video disimpan ke Galeri HP');
  };

  modal.classList.add('active');
}

if (modalPrevBtn) {
  modalPrevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeItemIndex < galleryItems.length - 1) openModalViewer(activeItemIndex + 1);
  });
}

if (modalNextBtn) {
  modalNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeItemIndex > 0) openModalViewer(activeItemIndex - 1);
  });
}

closeModalBtn.addEventListener('click', () => {
  stopMotionPlayback();
  modal.classList.remove('active');
});

deleteBtn.addEventListener('click', () => {
  const item = galleryItems[activeItemIndex];
  if (!item) return;
  triggerHaptic(20);
  deletePhotoFromDB(item.id);
  galleryItems.splice(activeItemIndex, 1);

  if (galleryItems.length > 0) {
    const nextIdx = Math.min(activeItemIndex, galleryItems.length - 1);
    updateBottomThumbnailUI(false);
    openModalViewer(nextIdx);
  } else {
    modal.classList.remove('active');
    updateBottomThumbnailUI(false);
  }
  showToast('🗑️ Dihapus dari galeri');
});

shareBtn.addEventListener('click', async () => {
  const item = galleryItems[activeItemIndex];
  if (!item) return;
  triggerHaptic(15);

  try {
    const shareBlob = item.isVideoOnly && item.videoBlob ? item.videoBlob : item.photoBlob;
    const shareName = item.filename || `IMG_${item.id}.jpg`;
    const shareType = item.isVideoOnly ? (item.videoBlob.type || 'video/mp4') : 'image/jpeg';

    if (navigator.share && shareBlob) {
      const file = new File([shareBlob], shareName, { type: shareType });
      await navigator.share({
        title: 'Foto-Live Camera',
        files: [file]
      });
    } else {
      triggerDeviceDownload(item.photoUrl, shareName);
      showToast('💾 File diunduh ke Galeri HP');
    }
  } catch (err) {}
});

// Touch & Hold or Swipe Left/Right inside Modal Viewer
let isHoldingMotion = false;
let modalTouchStartX = 0;

function startMotionPlayback() {
  const item = galleryItems[activeItemIndex];
  if (!item || !item.isLive || !item.videoUrl || item.isVideoOnly) return;

  isHoldingMotion = true;
  triggerHaptic(15);
  modalStillImg.style.display = 'none';
  modalMotionVideo.style.display = 'block';
  modalMotionVideo.muted = false;
  modalMotionVideo.currentTime = 0;
  modalMotionVideo.play().catch(() => {});
  holdHint.classList.add('playing');
}

function stopMotionPlayback() {
  if (!isHoldingMotion) {
    if (modalMotionVideo && !galleryItems[activeItemIndex]?.isVideoOnly) {
      modalMotionVideo.pause();
    }
    return;
  }
  isHoldingMotion = false;
  modalMotionVideo.pause();
  modalMotionVideo.style.display = 'none';
  modalStillImg.style.display = 'block';
  holdHint.classList.remove('playing');
}

if (playLiveBtn) {
  playLiveBtn.addEventListener('click', () => {
    if (isHoldingMotion) {
      stopMotionPlayback();
    } else {
      startMotionPlayback();
    }
  });
}

interactiveArea.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.modal-nav-btn')) return;
  modalTouchStartX = e.clientX;
  startMotionPlayback();
});

interactiveArea.addEventListener('pointerup', (e) => {
  stopMotionPlayback();
  const dx = e.clientX - modalTouchStartX;
  if (Math.abs(dx) > 65) {
    if (dx < 0 && activeItemIndex > 0) openModalViewer(activeItemIndex - 1);
    else if (dx > 0 && activeItemIndex < galleryItems.length - 1) openModalViewer(activeItemIndex + 1);
  }
});

interactiveArea.addEventListener('pointerleave', stopMotionPlayback);
interactiveArea.addEventListener('pointercancel', stopMotionPlayback);

// ============================================================================
// 12. INITIALIZATION
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  syncSettingsTrayUI();
  updateInstallUI();
  await loadPhotosFromDB();

  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get('mode');
  if (modeParam === 'video') setCameraMode('video');
  else if (modeParam === 'live') setCameraMode('live');

  await startCamera();

  if (params.get('action') === 'gallery' && galleryItems.length > 0) {
    openModalViewer(0);
  }
});
