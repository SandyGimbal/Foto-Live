// ==========================================
// LIVE PHOTO CAMERA - ADVANCED PWA ENGINE
// ==========================================

// --- State Variables ---
let currentStream = null;
let currentFacingMode = 'environment';
let isLiveActive = true;
let isCapturing = false;
let flashMode = 'off'; // 'off' | 'on' | 'auto'
let gridActive = false;
let timerSeconds = 0; // 0 | 3 | 10
let isDemoMode = false;
let deferredInstallPrompt = null;
let isAutoSaveActive = localStorage.getItem('fotolive_autosave') !== 'false'; // default aktif
let db = null;

// Photo Gallery Storage (Current Session & Recent Captures)
let galleryItems = [];
let activeItemIndex = -1;

// Audio Context for Native Shutter & Live Sounds
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
}

function playShutterSound() {
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Synthesize realistic camera mechanical click
    const bufferSize = audioCtx.sampleRate * 0.08;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, audioCtx.currentTime);
    filter.Q.setValueAtTime(2.5, audioCtx.currentTime);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}

function playLiveChime() {
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    
    // Warm rising two-tone Live chime
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  } catch (e) {
    console.warn('Live chime error:', e);
  }
}

// --- DOM Elements ---
const videoEl = document.getElementById('camera-video');
const fxCanvas = document.getElementById('fx-canvas');
const captureCanvas = document.getElementById('capture-canvas');
const fallbackImg = document.getElementById('fallback-viewfinder');
const gridOverlay = document.getElementById('grid-overlay');
const flashScreen = document.getElementById('flash-screen');
const recordingHud = document.getElementById('recording-hud');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');

// Top Controls
const liveToggle = document.getElementById('live-toggle');
const autosaveToggle = document.getElementById('autosave-toggle');
const flashToggle = document.getElementById('flash-toggle');
const gridToggle = document.getElementById('grid-toggle');
const timerToggle = document.getElementById('timer-toggle');
const demoToggle = document.getElementById('demo-toggle');
const installBtn = document.getElementById('btn-install');

// Bottom Controls
const shutterBtn = document.getElementById('shutter-btn');
const flipBtn = document.getElementById('flip-btn');
const galleryThumb = document.getElementById('gallery-thumb');
const thumbImg = document.getElementById('thumb-img');
const thumbCount = document.getElementById('thumb-count');

// Modal Elements
const modal = document.getElementById('preview-modal');
const modalStillImg = document.getElementById('modal-still-img');
const modalMotionVideo = document.getElementById('modal-motion-video');
const modalLiveBadge = document.getElementById('modal-live-badge');
const modalPhotoCounter = document.getElementById('modal-photo-counter');
const modalPrevBtn = document.getElementById('modal-prev-btn');
const modalNextBtn = document.getElementById('modal-next-btn');
const holdHint = document.getElementById('hold-hint');
const interactiveArea = document.getElementById('interactive-area');
const closeModalBtn = document.getElementById('close-modal-btn');
const downloadPhotoBtn = document.getElementById('download-photo-btn');
const downloadVideoBtn = document.getElementById('download-video-btn');
const deleteBtn = document.getElementById('delete-btn');
const shareBtn = document.getElementById('share-btn');

// Install Sheet
const installSheetBackdrop = document.getElementById('install-sheet-backdrop');
const btnTriggerInstall = document.getElementById('btn-trigger-install');
const btnCloseSheet = document.getElementById('btn-close-sheet');
const toastEl = document.getElementById('toast');

// --- Toast Utility ---
function showToast(message, duration = 3000) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

// ==========================================
// 1. PWA INSTALL & SHORTCUT MANAGEMENT
// ==========================================

function checkStandaloneMode() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true ||
                       document.referrer.includes('android-app://');
  
  if (isStandalone) {
    installBtn.textContent = '✓ Pintasan Aktif';
    installBtn.classList.add('installed');
    installBtn.title = 'Aplikasi dibuka dari Pintasan Layar Utama';
  }
}

// Listen for native install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.style.display = 'inline-flex';
  installBtn.textContent = '📲 Pasang Pintasan';
  console.log('beforeinstallprompt event captured');
});

// Detect when installed successfully
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installBtn.textContent = '✓ Terpasang';
  installBtn.classList.add('installed');
  showToast('🎉 Aplikasi berhasil dipasang di layar utama!');
  if (installSheetBackdrop) installSheetBackdrop.classList.remove('active');
});

// Click handler for Install button
installBtn.addEventListener('click', () => {
  handleInstallAction();
});

btnTriggerInstall.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    installSheetBackdrop.classList.remove('active');
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Pintasan sedang ditambahkan ke layar utama...');
      installBtn.style.display = 'none';
    }
    deferredInstallPrompt = null;
  } else {
    // If not supported natively or on iOS
    showToast('Ikuti panduan di atas untuk menambahkan pintasan');
  }
});

btnCloseSheet.addEventListener('click', () => {
  installSheetBackdrop.classList.remove('active');
});

installSheetBackdrop.addEventListener('click', (e) => {
  if (e.target === installSheetBackdrop) {
    installSheetBackdrop.classList.remove('active');
  }
});

function handleInstallAction() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    showToast('Aplikasi sudah berjalan dari pintasan layar utama!');
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('Pintasan berhasil dipasang!');
      }
      deferredInstallPrompt = null;
    });
  } else {
    // Show instruction sheet
    installSheetBackdrop.classList.add('active');
  }
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('Service Worker registered with scope:', reg.scope))
      .catch((err) => console.warn('Service Worker registration failed:', err));
  });
}

// ==========================================
// 2. CAMERA ENGINE & STREAMING
// ==========================================

async function startCamera() {
  if (isDemoMode) {
    activateDemoScene();
    return;
  }

  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }

  fallbackImg.classList.remove('active');
  videoEl.style.display = 'block';

  try {
    const constraints = {
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 30 }
      },
      audio: isLiveActive // Request mic if Live mode is enabled
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (audioErr) {
      // If mic was rejected or unavailable, fallback to video-only
      console.warn('Audio not available, trying video only:', audioErr);
      stream = await navigator.mediaDevices.getUserMedia({
        video: constraints.video,
        audio: false
      });
    }

    currentStream = stream;
    videoEl.srcObject = stream;
    videoEl.classList.toggle('mirror', currentFacingMode === 'user');

    await videoEl.play();
  } catch (err) {
    console.warn('Camera could not be started, activating Anti-Gravity Simulation:', err);
    activateDemoScene();
    showToast('Mode Anti-Gravitasi aktif (kamera tidak dapat diakses)');
  }
}

function activateDemoScene() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  videoEl.style.display = 'none';
  fallbackImg.classList.add('active');
  isDemoMode = true;
  demoToggle.classList.add('active');
}

function deactivateDemoScene() {
  isDemoMode = false;
  demoToggle.classList.remove('active');
  fallbackImg.classList.remove('active');
  startCamera();
}

// Flip Camera
flipBtn.addEventListener('click', () => {
  if (isDemoMode) {
    showToast('Kembali ke kamera fisik');
    deactivateDemoScene();
    return;
  }
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  startCamera();
  showToast(currentFacingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang', 1500);
});

// Live Photo Mode Toggle
liveToggle.addEventListener('click', () => {
  isLiveActive = !isLiveActive;
  liveToggle.classList.toggle('off', !isLiveActive);
  liveToggle.classList.toggle('active', isLiveActive);
  shutterBtn.classList.toggle('live-active', isLiveActive);
  
  if (isLiveActive) {
    playLiveChime();
    showToast('Mode LIVE aktif ◎');
  } else {
    showToast('Mode Foto Standar');
  }

  // Restart camera to re-bind audio stream if needed
  if (!isDemoMode) startCamera();
});

// Flash Toggle
flashToggle.addEventListener('click', () => {
  if (flashMode === 'off') {
    flashMode = 'on';
    flashToggle.classList.add('active');
    flashToggle.innerHTML = `⚡ <span style="font-size:10px;">ON</span>`;
    showToast('Flash Aktif');
  } else if (flashMode === 'on') {
    flashMode = 'auto';
    flashToggle.classList.add('active');
    flashToggle.innerHTML = `⚡ <span style="font-size:10px;">AUTO</span>`;
    showToast('Flash Auto');
  } else {
    flashMode = 'off';
    flashToggle.classList.remove('active');
    flashToggle.innerHTML = `⚡`;
    showToast('Flash Mati');
  }
});

// Grid Toggle
gridToggle.addEventListener('click', () => {
  gridActive = !gridActive;
  gridOverlay.classList.toggle('active', gridActive);
  gridToggle.classList.toggle('active', gridActive);
  showToast(gridActive ? 'Grid 3x3 Aktif' : 'Grid Mati', 1200);
});

// Timer Toggle
timerToggle.addEventListener('click', () => {
  if (timerSeconds === 0) {
    timerSeconds = 3;
    timerToggle.classList.add('active');
    timerToggle.innerHTML = `⏱️ 3s`;
    showToast('Timer 3 Detik');
  } else if (timerSeconds === 3) {
    timerSeconds = 10;
    timerToggle.classList.add('active');
    timerToggle.innerHTML = `⏱️ 10s`;
    showToast('Timer 10 Detik');
  } else {
    timerSeconds = 0;
    timerToggle.classList.remove('active');
    timerToggle.innerHTML = `⏱️`;
    showToast('Timer Mati');
  }
});

// Auto-Save Toggle
function updateAutoSaveUI() {
  if (!autosaveToggle) return;
  if (isAutoSaveActive) {
    autosaveToggle.classList.add('active');
    autosaveToggle.innerHTML = `💾 <span style="font-size:9px; font-weight:700;">ON</span>`;
    autosaveToggle.title = 'Auto-Save ke Galeri HP: AKTIF';
  } else {
    autosaveToggle.classList.remove('active');
    autosaveToggle.innerHTML = `💾`;
    autosaveToggle.title = 'Auto-Save ke Galeri HP: NONAKTIF';
  }
}

if (autosaveToggle) {
  autosaveToggle.addEventListener('click', () => {
    isAutoSaveActive = !isAutoSaveActive;
    localStorage.setItem('fotolive_autosave', isAutoSaveActive ? 'true' : 'false');
    updateAutoSaveUI();
    showToast(isAutoSaveActive ? 'Auto-Save ke Galeri HP: AKTIF 💾' : 'Auto-Save ke Galeri HP: NONAKTIF');
  });
}

// Demo Zero-G Toggle
demoToggle.addEventListener('click', () => {
  if (isDemoMode) {
    deactivateDemoScene();
    showToast('Kamera Normal');
  } else {
    activateDemoScene();
    showToast('Mode Simulasi Zero-Gravity Aktif ✨');
  }
});

// ==========================================
// 3. CAPTURE LOGIC (LIVE PHOTO & MOTION CLIP)
// ==========================================

shutterBtn.addEventListener('click', () => {
  if (isCapturing) return;

  if (timerSeconds > 0) {
    runCountdown(timerSeconds, () => executeCapture());
  } else {
    executeCapture();
  }
});

function runCountdown(seconds, callback) {
  let count = seconds;
  countdownOverlay.classList.add('active');
  countdownNumber.textContent = count;
  
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNumber.textContent = count;
    } else {
      clearInterval(interval);
      countdownOverlay.classList.remove('active');
      callback();
    }
  }, 1000);
}

async function executeCapture() {
  isCapturing = true;
  shutterBtn.classList.add('pressing');
  playShutterSound();

  // Screen Flash
  if (flashMode === 'on' || (flashMode === 'auto' && Math.random() > 0.4)) {
    flashScreen.classList.add('trigger');
    setTimeout(() => flashScreen.classList.remove('trigger'), 120);
  }

  // --- Step 1: Capture High-Res Still Frame ---
  let stillBlob = null;
  const ctx = captureCanvas.getContext('2d');

  if (isDemoMode) {
    // Capture from Fallback Zero-Gravity image
    captureCanvas.width = fallbackImg.naturalWidth || 1080;
    captureCanvas.height = fallbackImg.naturalHeight || 1920;
    ctx.drawImage(fallbackImg, 0, 0, captureCanvas.width, captureCanvas.height);
  } else {
    captureCanvas.width = videoEl.videoWidth || 1920;
    captureCanvas.height = videoEl.videoHeight || 1080;
    if (currentFacingMode === 'user') {
      ctx.translate(captureCanvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, 0, 0, captureCanvas.width, captureCanvas.height);
  }

  stillBlob = await new Promise((resolve) => captureCanvas.toBlob(resolve, 'image/jpeg', 0.95));

  // --- Step 2: Record Live Motion Clip (if LIVE is active) ---
  if (isLiveActive) {
    recordingHud.classList.add('active');
    shutterBtn.classList.add('recording');
    playLiveChime();

    let motionBlob = null;
    try {
      motionBlob = await recordMotionClip();
    } catch (recErr) {
      console.warn('Motion recording error:', recErr);
    }

    recordingHud.classList.remove('active');
    shutterBtn.classList.remove('recording');

    saveCaptureToGallery(stillBlob, motionBlob, true);
  } else {
    saveCaptureToGallery(stillBlob, null, false);
  }

  shutterBtn.classList.remove('pressing');
  isCapturing = false;
}

function recordMotionClip() {
  return new Promise((resolve) => {
    let streamToRecord = null;

    if (isDemoMode) {
      // In demo mode, capture canvas stream with simulated floating motion
      const animStream = createZeroGMotionStream();
      streamToRecord = animStream;
    } else {
      streamToRecord = currentStream;
    }

    if (!streamToRecord) {
      resolve(null);
      return;
    }

    let recordedChunks = [];
    let mediaRecorder;

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];

    let chosenMime = mimeTypes.find(type => {
      try {
        return MediaRecorder.isTypeSupported(type);
      } catch (e) {
        return false;
      }
    }) || '';

    try {
      mediaRecorder = chosenMime ? new MediaRecorder(streamToRecord, { mimeType: chosenMime }) : new MediaRecorder(streamToRecord);
    } catch (e) {
      mediaRecorder = new MediaRecorder(streamToRecord);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const type = chosenMime || 'video/webm';
      const blob = new Blob(recordedChunks, { type });
      resolve(blob);
    };

    mediaRecorder.start();

    // 1.8 seconds motion clip (Standard Apple / Android Live Photo duration)
    setTimeout(() => {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }, 1800);
  });
}

// Generate animated zero-gravity movement for demo mode
function createZeroGMotionStream() {
  const motionCanvas = document.createElement('canvas');
  motionCanvas.width = 1080;
  motionCanvas.height = 1920;
  const mCtx = motionCanvas.getContext('2d');
  const stream = motionCanvas.captureStream(30);

  let startTime = Date.now();
  const renderAnim = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    mCtx.clearRect(0, 0, motionCanvas.width, motionCanvas.height);
    
    // Slight organic floating bobbing effect
    const floatY = Math.sin(elapsed * 3) * 12;
    const floatScale = 1 + Math.cos(elapsed * 2) * 0.015;

    mCtx.save();
    mCtx.translate(motionCanvas.width / 2, motionCanvas.height / 2 + floatY);
    mCtx.scale(floatScale, floatScale);
    mCtx.drawImage(fallbackImg, -motionCanvas.width / 2, -motionCanvas.height / 2, motionCanvas.width, motionCanvas.height);
    mCtx.restore();

    if (elapsed < 2.0) {
      requestAnimationFrame(renderAnim);
    }
  };
  requestAnimationFrame(renderAnim);

  return stream;
}

// ==========================================
// 4. STORAGE (INDEXEDDB) & AUTO-SAVE GALLERY
// ==========================================

function initDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB tidak didukung pada browser ini');
      resolve(null);
      return;
    }
    const request = indexedDB.open('FotoLiveDB', 1);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('photos')) {
        database.createObjectStore('photos', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = (e) => {
      console.warn('Gagal membuka IndexedDB:', e);
      resolve(null);
    };
  });
}

function savePhotoToDB(item) {
  if (!db) return;
  try {
    const tx = db.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    store.put({
      id: item.id,
      timestamp: item.timestamp,
      photoBlob: item.photoBlob,
      videoBlob: item.videoBlob,
      isLive: item.isLive
    });
  } catch (err) {
    console.warn('Gagal menyimpan ke IndexedDB:', err);
  }
}

async function loadPhotosFromDB() {
  if (!db) await initDB();
  if (!db) return;

  try {
    const tx = db.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
    const request = store.getAll();
    request.onsuccess = () => {
      const savedItems = request.result || [];
      savedItems.sort((a, b) => b.id - a.id); // Foto terbaru di awal

      galleryItems = savedItems.map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        photoBlob: s.photoBlob,
        photoUrl: URL.createObjectURL(s.photoBlob),
        videoBlob: s.videoBlob,
        videoUrl: s.videoBlob ? URL.createObjectURL(s.videoBlob) : null,
        isLive: s.isLive
      }));

      if (galleryItems.length > 0) {
        thumbImg.src = galleryItems[0].photoUrl;
        thumbImg.style.display = 'block';
        const thumbIcon = document.getElementById('thumb-icon');
        if (thumbIcon) thumbIcon.style.display = 'none';
        thumbCount.textContent = galleryItems.length;
        thumbCount.style.display = 'block';
        galleryThumb.style.display = 'flex';
      }
    };
  } catch (err) {
    console.warn('Gagal memuat galeri dari IndexedDB:', err);
  }
}

function deletePhotoFromDB(id) {
  if (!db) return;
  try {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').delete(id);
  } catch (err) {
    console.warn('Gagal menghapus dari IndexedDB:', err);
  }
}

// Otomatis Simpan ke Penyimpanan/Galeri HP (File .jpg & .webm)
function autoSaveToDeviceGallery(item) {
  if (!isAutoSaveActive) return;

  try {
    // 1. Simpan foto diam JPG (otomatis masuk album Unduhan/Galeri HP)
    const a = document.createElement('a');
    a.href = item.photoUrl;
    a.download = `FotoLive_${item.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 2. Jika mode Live Photo aktif, simpan juga klip geraknya
    if (item.isLive && item.videoUrl) {
      setTimeout(() => {
        const v = document.createElement('a');
        v.href = item.videoUrl;
        v.download = `FotoLive_Motion_${item.id}.webm`;
        document.body.appendChild(v);
        v.click();
        document.body.removeChild(v);
      }, 350);
    }
  } catch (err) {
    console.warn('Gagal auto-save ke perangkat:', err);
  }
}

// ==========================================
// 5. GALLERY & INTERACTIVE VIEWER
// ==========================================

function saveCaptureToGallery(photoBlob, videoBlob, isLive) {
  const item = {
    id: Date.now(),
    timestamp: new Date().toLocaleTimeString('id-ID'),
    photoBlob: photoBlob,
    photoUrl: URL.createObjectURL(photoBlob),
    videoBlob: videoBlob,
    videoUrl: videoBlob ? URL.createObjectURL(videoBlob) : null,
    isLive: isLive
  };

  galleryItems.unshift(item);
  activeItemIndex = 0;

  // 1. Simpan permanen ke IndexedDB
  savePhotoToDB(item);

  // 2. Simpan otomatis ke Galeri HP (Download / DCIM)
  if (isAutoSaveActive) {
    autoSaveToDeviceGallery(item);
  }

  // Update thumbnail in bottom-left
  thumbImg.src = item.photoUrl;
  thumbImg.style.display = 'block';
  const thumbIcon = document.getElementById('thumb-icon');
  if (thumbIcon) thumbIcon.style.display = 'none';
  thumbCount.textContent = galleryItems.length;
  thumbCount.style.display = 'block';
  galleryThumb.style.display = 'flex';

  if (isAutoSaveActive) {
    showToast(isLive ? 'Foto-Live otomatis tersimpan ke Galeri HP! ◎' : 'Foto otomatis tersimpan ke Galeri HP! 📸', 2200);
  } else {
    showToast(isLive ? 'Foto-Live tersimpan di galeri ◎' : 'Foto tersimpan di galeri 📸', 1800);
  }
}

galleryThumb.addEventListener('click', () => {
  if (galleryItems.length === 0) {
    showToast('Belum ada foto yang diambil');
    return;
  }
  openModalViewer(0);
});

function updateModalNavUI() {
  if (modalPhotoCounter) {
    modalPhotoCounter.textContent = `${activeItemIndex + 1} / ${galleryItems.length}`;
  }
  if (modalPrevBtn) {
    modalPrevBtn.classList.toggle('disabled', activeItemIndex >= galleryItems.length - 1);
  }
  if (modalNextBtn) {
    modalNextBtn.classList.toggle('disabled', activeItemIndex <= 0);
  }
}

if (modalPrevBtn) {
  modalPrevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeItemIndex < galleryItems.length - 1) {
      openModalViewer(activeItemIndex + 1);
    }
  });
}

if (modalNextBtn) {
  modalNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeItemIndex > 0) {
      openModalViewer(activeItemIndex - 1);
    }
  });
}

function openModalViewer(index) {
  activeItemIndex = index;
  const item = galleryItems[activeItemIndex];
  if (!item) return;

  modalStillImg.src = item.photoUrl;
  modalStillImg.style.display = 'block';

  if (item.isLive && item.videoUrl) {
    modalMotionVideo.src = item.videoUrl;
    modalMotionVideo.style.display = 'none';
    modalLiveBadge.style.display = 'inline-flex';
    holdHint.style.display = 'flex';
    downloadVideoBtn.style.display = 'inline-flex';
  } else {
    modalMotionVideo.src = '';
    modalMotionVideo.style.display = 'none';
    modalLiveBadge.style.display = 'none';
    holdHint.style.display = 'none';
    downloadVideoBtn.style.display = 'none';
  }

  updateModalNavUI();

  // Setup download links
  downloadPhotoBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = item.photoUrl;
    a.download = `FotoLive_Photo_${item.id}.jpg`;
    a.click();
    showToast('Foto JPG diunduh');
  };

  downloadVideoBtn.onclick = () => {
    if (!item.videoUrl) return;
    const a = document.createElement('a');
    a.href = item.videoUrl;
    a.download = `FotoLive_Motion_${item.id}.webm`;
    a.click();
    showToast('Klip video gerak diunduh');
  };

  modal.classList.add('active');
}

closeModalBtn.addEventListener('click', () => {
  modal.classList.remove('active');
  modalMotionVideo.pause();
});

// Delete active capture
deleteBtn.addEventListener('click', () => {
  if (confirm('Hapus foto ini dari galeri?')) {
    const deletedItem = galleryItems[activeItemIndex];
    if (deletedItem) {
      deletePhotoFromDB(deletedItem.id);
    }

    galleryItems.splice(activeItemIndex, 1);
    if (galleryItems.length > 0) {
      const nextIndex = Math.min(activeItemIndex, galleryItems.length - 1);
      thumbCount.textContent = galleryItems.length;
      thumbImg.src = galleryItems[0].photoUrl;
      openModalViewer(nextIndex);
    } else {
      modal.classList.remove('active');
      thumbImg.src = '';
      thumbImg.style.display = 'none';
      const thumbIcon = document.getElementById('thumb-icon');
      if (thumbIcon) thumbIcon.style.display = 'block';
      thumbCount.style.display = 'none';
      thumbCount.textContent = '0';
    }
    showToast('Foto dihapus dari galeri');
  }
});

// Share API
shareBtn.addEventListener('click', async () => {
  const item = galleryItems[activeItemIndex];
  if (!item) return;

  try {
    if (navigator.share && item.photoBlob) {
      const file = new File([item.photoBlob], `FotoLive_${item.id}.jpg`, { type: 'image/jpeg' });
      await navigator.share({
        title: 'Foto-Live',
        text: 'Lihat foto gerak yang saya ambil dengan aplikasi Foto-Live!',
        files: [file]
      });
      showToast('Berhasil dibagikan');
    } else {
      showToast('Gunakan tombol Unduh untuk menyimpan');
    }
  } catch (err) {
    console.warn('Share error:', err);
  }
});

// --- Touch & Hold to Play Motion (Apple / Android Live Photo Gesture) ---
let isHoldingMotion = false;

function startMotionPlayback(e) {
  const item = galleryItems[activeItemIndex];
  if (!item || !item.isLive || !item.videoUrl) return;

  isHoldingMotion = true;
  modalStillImg.style.display = 'none';
  modalMotionVideo.style.display = 'block';
  modalMotionVideo.currentTime = 0;
  modalMotionVideo.play().catch(e => console.warn('Video play error:', e));

  holdHint.classList.add('playing');
  modalLiveBadge.classList.add('active');
  playLiveChime();
}

function stopMotionPlayback(e) {
  if (!isHoldingMotion) return;
  isHoldingMotion = false;

  modalMotionVideo.pause();
  modalMotionVideo.style.display = 'none';
  modalStillImg.style.display = 'block';

  holdHint.classList.remove('playing');
  modalLiveBadge.classList.remove('active');
}

interactiveArea.addEventListener('pointerdown', startMotionPlayback);
interactiveArea.addEventListener('pointerup', stopMotionPlayback);
interactiveArea.addEventListener('pointerleave', stopMotionPlayback);
interactiveArea.addEventListener('pointercancel', stopMotionPlayback);

// ==========================================
// 6. INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  updateAutoSaveUI();
  await loadPhotosFromDB();
  checkStandaloneMode();
  startCamera();
});
