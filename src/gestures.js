// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — MediaPipe Hands Gesture Engine v3 (Performance)
// Real 21-landmark hand tracking + gesture recognition
// Optimized: faster frame skip, reduced pixel scan, batched draws
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    let handsInstance = null;
    let cameraStream = null;
    let isRunning = false;
    let onGestureCallback = null;
    let lastGesture = null;
    let lastGestureTime = 0;
    const GESTURE_COOLDOWN = 500;       // 800→500ms for snappier response
    let currentLandmarks = null;
    let mediaPipeLoaded = false;
    let activeMode = null; // 'mediapipe' or 'basic'
    let frameSkipCounter = 0;
    const FRAME_SKIP = 1;               // process every 2nd frame (huge perf win)

    // ─── Pre-allocated vectors (avoid GC per frame) ───
    const _wristVec = { x: 0, y: 0 };
    const _tipVec = { x: 0, y: 0 };

    // ─── Load MediaPipe scripts dynamically ───
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) { resolve(); return; }
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load: ${src}`));
            document.head.appendChild(script);
        });
    }

    async function loadMediaPipe() {
        if (mediaPipeLoaded) return;
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js');
        // Give scripts time to initialize
        await new Promise(r => setTimeout(r, 200));
        mediaPipeLoaded = true;
    }

    // ─── Initialize hand tracking ───
    async function init(videoElement, canvasElement, callback) {
        if (isRunning) {
            console.warn('Gesture engine already running');
            return;
        }

        onGestureCallback = callback;

        // Step 1: Load MediaPipe
        try {
            await loadMediaPipe();
        } catch (e) {
            console.warn('MediaPipe CDN load failed:', e.message);
            return initBasic(videoElement, canvasElement, callback);
        }

        // Step 2: Check if Hands constructor exists
        if (typeof Hands === 'undefined') {
            console.warn('Hands constructor not available, using basic detection');
            return initBasic(videoElement, canvasElement, callback);
        }

        // Step 3: Get camera stream first
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' },
            });
            videoElement.srcObject = cameraStream;
            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                videoElement.onloadedmetadata = resolve;
                videoElement.onerror = reject;
                setTimeout(reject, 5000);
            });
            await videoElement.play();
        } catch (err) {
            console.error('Camera access failed:', err);
            throw new Error('Camera access denied or unavailable');
        }

        // Step 4: Initialize Hands
        try {
            handsInstance = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
                },
            });

            handsInstance.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.6,
                minTrackingConfidence: 0.5,
            });

            handsInstance.onResults((results) => {
                processResults(results, canvasElement);
            });
        } catch (err) {
            console.error('Hands init failed:', err);
            return initBasic(videoElement, canvasElement, callback);
        }

        // Step 5: Start detection loop with frame skipping
        isRunning = true;
        activeMode = 'mediapipe';
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;

        let sending = false;
        frameSkipCounter = 0;
        async function detectFrame() {
            if (!isRunning || !handsInstance) return;

            // Frame skip: only send every N+1 frame
            frameSkipCounter++;
            if (frameSkipCounter <= FRAME_SKIP) {
                requestAnimationFrame(detectFrame);
                return;
            }
            frameSkipCounter = 0;

            if (!sending && videoElement.readyState >= 2) {
                sending = true;
                try {
                    await handsInstance.send({ image: videoElement });
                } catch (e) {
                    // Skip failed frames
                }
                sending = false;
            }
            requestAnimationFrame(detectFrame);
        }
        detectFrame();
    }

    // ─── Process hand landmarks (batched, minimal DOM writes) ───
    function processResults(results, canvas) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            currentLandmarks = null;
            // Only clear if we previously drew
            if (canvas._hadLandmarks) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas._hadLandmarks = false;
            }
            return;
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas._hadLandmarks = true;

        const w = canvas.width;
        const h = canvas.height;

        results.multiHandLandmarks.forEach((landmarks) => {
            currentLandmarks = landmarks;

            // Draw hand skeleton overlay (batched)
            drawHand(ctx, landmarks, w, h);

            // Capture frame if recording
            if (recordingEnabled && landmarks) {
                capturedFrames.push(landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 })));
            }

            // Recognize gesture
            const gesture = recognizeGesture(landmarks);
            if (gesture && gesture !== lastGesture) {
                const now = Date.now();
                if (now - lastGestureTime > GESTURE_COOLDOWN) {
                    lastGesture = gesture;
                    lastGestureTime = now;
                    if (onGestureCallback) onGestureCallback(gesture, landmarks);
                    setTimeout(() => { lastGesture = null; }, GESTURE_COOLDOWN);
                }
            }
        });
    }

    // ─── Draw hand skeleton (21 landmarks, 20 connections) ───
    const HAND_CONNECTIONS = [
        [0,1],[1,2],[2,3],[3,4],        // thumb
        [0,5],[5,6],[6,7],[7,8],        // index
        [0,9],[9,10],[10,11],[11,12],   // middle
        [0,13],[13,14],[14,15],[15,16], // ring
        [0,17],[17,18],[18,19],[19,20], // pinky
        [5,9],[9,13],[13,17],           // palm bridge
    ];

    function drawHand(ctx, landmarks, w, h) {
        // Set shadow once (not per-line)
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 212, 255, 0.5)';
        ctx.shadowBlur = 4;

        // Batch all lines in single beginPath/stroke
        ctx.beginPath();
        for (let i = 0; i < HAND_CONNECTIONS.length; i++) {
            const [a, b] = HAND_CONNECTIONS[i];
            ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
            ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw landmark points (batch fillStyle changes)
        const colors = []; // pre-computed per landmark
        const tipLabels = { 4: 'T', 8: 'I', 12: 'M', 16: 'R', 20: 'P' };

        for (let i = 0; i < landmarks.length; i++) {
            const lm = landmarks[i];
            const x = lm.x * w;
            const y = lm.y * h;
            const isTip = tipLabels[i] !== undefined;
            const isWrist = i === 0;
            const radius = isWrist ? 6 : isTip ? 5 : 3;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = isTip ? '#00ff88' : isWrist ? '#ff6600' : '#00d4ff';
            ctx.fill();

            if (isTip) {
                ctx.font = '10px Orbitron, monospace';
                ctx.fillStyle = '#00ff88';
                ctx.fillText(tipLabels[i], x + 8, y - 4);
            }
        }
    }

    // ─── Gesture recognition (optimized: inlined distances, no hypot alloc) ───
    function recognizeGesture(lm) {
        const thumbTip = lm[4], thumbIP = lm[3], thumbMCP = lm[2];
        const indexTip = lm[8], indexPIP = lm[6];
        const middleTip = lm[12], middlePIP = lm[10];
        const ringTip = lm[16], ringPIP = lm[14];
        const pinkyTip = lm[20], pinkyPIP = lm[18];
        const wrist = lm[0];

        const indexExtended = indexTip.y < indexPIP.y;
        const middleExtended = middleTip.y < middlePIP.y;
        const ringExtended = ringTip.y < ringPIP.y;
        const pinkyExtended = pinkyTip.y < pinkyPIP.y;

        // Thumb: squared distance (avoids sqrt)
        const td = (thumbTip.x - wrist.x) ** 2 + (thumbTip.y - wrist.y) ** 2;
        const tdIP = (thumbIP.x - wrist.x) ** 2 + (thumbIP.y - wrist.y) ** 2;
        const thumbExtended = td > tdIP;

        const extendedCount = (indexExtended ? 1 : 0) + (middleExtended ? 1 : 0) +
                              (ringExtended ? 1 : 0) + (pinkyExtended ? 1 : 0);

        // Fast-path: most common gestures first
        if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) return 'point';
        if (extendedCount === 4) return 'open_palm';
        if (extendedCount === 0 && !thumbExtended) return 'fist';

        // Pinch check (squared distance)
        const pinchDist = (thumbTip.x - indexTip.x) ** 2 + (thumbTip.y - indexTip.y) ** 2;
        if (pinchDist < 0.0025) return 'pinch'; // 0.05²

        if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) return 'peace';
        if (indexExtended && middleExtended && ringExtended && !pinkyExtended) return 'three';

        if (thumbExtended && extendedCount === 0) {
            return thumbTip.y < thumbMCP.y ? 'thumbs_up' : 'thumbs_down';
        }

        if (pinchDist < 0.0049 && middleExtended && ringExtended && pinkyExtended) return 'ok_sign'; // 0.07²
        if (indexExtended && !middleExtended && !ringExtended && pinkyExtended) return 'rock';

        // Swipe (edge zones)
        if (wrist.x < 0.15) return 'swipe_right';
        if (wrist.x > 0.85) return 'swipe_left';
        if (wrist.y < 0.15) return 'swipe_up';
        if (wrist.y > 0.85) return 'swipe_down';

        return null;
    }

    // ─── Recording support ───
    let recordingEnabled = false;
    let capturedFrames = [];

    function startRecording() {
        recordingEnabled = true;
        capturedFrames = [];
    }

    function stopRecording() {
        recordingEnabled = false;
        return [...capturedFrames];
    }

    function captureFrame(landmarks) {
        if (!recordingEnabled || !landmarks) return;
        capturedFrames.push(landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 })));
    }

    // ─── Template comparison (DTW-inspired) ───
    function compareTemplates(templateA, templateB) {
        if (!templateA?.length || !templateB?.length) return 0;

        // Average each template to a single 21-point frame
        const avgA = averageFrame(templateA);
        const avgB = averageFrame(templateB);

        // Normalize both frames relative to wrist position
        const normA = normalizeFrame(avgA);
        const normB = normalizeFrame(avgB);

        // Calculate average landmark distance
        let totalDist = 0;
        for (let i = 0; i < 21; i++) {
            totalDist += Math.hypot(
                normA[i].x - normB[i].x,
                normA[i].y - normB[i].y
            );
        }
        const avgDist = totalDist / 21;

        // Convert to similarity score (0-1)
        return Math.max(0, Math.min(1, 1 - avgDist * 5));
    }

    function averageFrame(frames) {
        const avg = [];
        for (let i = 0; i < 21; i++) {
            let x = 0, y = 0, z = 0;
            frames.forEach(f => {
                x += f[i].x;
                y += f[i].y;
                z += f[i].z || 0;
            });
            const n = frames.length;
            avg.push({ x: x / n, y: y / n, z: z / n });
        }
        return avg;
    }

    function normalizeFrame(frame) {
        // Normalize relative to wrist (landmark 0)
        const wrist = frame[0];
        return frame.map(lm => ({
            x: lm.x - wrist.x,
            y: lm.y - wrist.y,
            z: lm.z - wrist.z,
        }));
    }

    // ─── Stop everything ───
    function stop() {
        isRunning = false;
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            cameraStream = null;
        }
        if (handsInstance) {
            try { handsInstance.close(); } catch (e) {}
            handsInstance = null;
        }
        currentLandmarks = null;
    }

    // ─── Basic fallback (motion-based, no MediaPipe) ───
    function initBasic(video, canvas, callback) {
        console.log('[Gestures] Using basic motion detection fallback');
        return new Promise(async (resolve) => {
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240 },
                });
                video.srcObject = cameraStream;
                await video.play();

                const ctx = canvas.getContext('2d');
                canvas.width = 320;
                canvas.height = 240;
                isRunning = true;
                activeMode = 'basic';

                let prevFrame = null;
                let motionHistory = [];
                let basicFrameSkip = 0;

                function detect() {
                    if (!isRunning) return;
                    requestAnimationFrame(detect);

                    // Skip every other frame in basic mode too
                    basicFrameSkip++;
                    if (basicFrameSkip <= 1) return;
                    basicFrameSkip = 0;

                    ctx.drawImage(video, 0, 0, 320, 240);

                    // Simple motion detection
                    try {
                        const imgData = ctx.getImageData(0, 0, 320, 240);
                        if (prevFrame) {
                            const motion = detectMotionRegions(prevFrame, imgData);
                            if (motion) {
                                motionHistory.push({ type: motion, time: Date.now() });
                                // Keep last 10
                                if (motionHistory.length > 10) motionHistory.shift();

                                const now = Date.now();
                                if (now - lastGestureTime > GESTURE_COOLDOWN) {
                                    lastGestureTime = now;
                                    if (callback) callback(motion, null);
                                }
                            }
                        }
                        prevFrame = imgData;
                    } catch (e) {}

                    // Draw guide box
                    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(60, 40, 200, 160);
                    ctx.font = '10px Orbitron, monospace';
                    ctx.fillStyle = 'rgba(0, 212, 255, 0.5)';
                    ctx.fillText('BASIC MODE', 100, 30);
                }
                detect();
                resolve();
            } catch (e) {
                console.error('Basic detection also failed:', e);
                resolve();
            }
        });
    }

    function detectMotionRegions(prev, curr) {
        let left = 0, right = 0, top = 0, bottom = 0, total = 0;
        const w = prev.width, h = prev.height;
        const halfW = w >> 1;
        const halfH = h >> 1;
        const data1 = prev.data;
        const data2 = curr.data;

        // Stride 32 (was 20) — fewer iterations, still accurate
        for (let i = 0; i < data1.length; i += 32) {
            const diff = (data1[i] - data2[i]) +
                         (data1[i + 1] - data2[i + 1]) +
                         (data1[i + 2] - data2[i + 2]);
            // Use abs only when diff is significant (branch prediction win)
            const absDiff = diff < 0 ? -diff : diff;
            if (absDiff > 50) {
                total++;
                const px = ((i >> 2) % w);
                const py = ((i >> 2) / w) | 0;
                if (px < halfW) left++; else right++;
                if (py < halfH) top++; else bottom++;
            }
        }

        if (total < 300) return null;

        // Early exit for dominant direction
        if (left > right * 2.5) return 'swipe_right';
        if (right > left * 2.5) return 'swipe_left';
        if (top > bottom * 2.5) return 'swipe_down';
        if (bottom > top * 2.5) return 'swipe_up';

        return 'wave';
    }

    // ─── Get current landmarks (for external use) ───
    function getLandmarks() {
        return currentLandmarks;
    }

    // Export
    window.JarvisGestures = {
        init,
        stop,
        startRecording,
        stopRecording,
        captureFrame,
        compareTemplates,
        recognizeGesture,
        getLandmarks,
        isRunning: () => isRunning,
        getMode: () => activeMode,
    };
})();
