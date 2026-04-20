// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — MediaPipe Hands Gesture Engine
// Real 21-landmark hand tracking + gesture recognition
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    let handsModel = null;
    let cameraStream = null;
    let isRunning = false;
    let onGestureCallback = null;
    let lastGesture = null;
    let lastGestureTime = 0;
    const GESTURE_COOLDOWN = 1000; // ms between gesture triggers

    // ─── Load MediaPipe Hands via CDN ───
    async function loadMediaPipe() {
        return new Promise((resolve, reject) => {
            // Load hands solution
            const script1 = document.createElement('script');
            script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js';
            script1.onload = () => {
                // Load camera utils
                const script2 = document.createElement('script');
                script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js';
                script2.onload = resolve;
                script2.onerror = reject;
                document.head.appendChild(script2);
            };
            script1.onerror = reject;
            document.head.appendChild(script1);
        });
    }

    // ─── Initialize hand tracking ───
    async function init(videoElement, canvasElement, callback) {
        onGestureCallback = callback;

        try {
            await loadMediaPipe();
        } catch (e) {
            console.warn('MediaPipe load failed, falling back to basic detection');
            return initBasic(videoElement, canvasElement, callback);
        }

        if (typeof Hands === 'undefined') {
            console.warn('Hands not available, falling back');
            return initBasic(videoElement, canvasElement, callback);
        }

        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => processResults(results, canvasElement));

        handsModel = hands;

        // Start camera
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' },
            });
            videoElement.srcObject = cameraStream;
            await videoElement.play();

            isRunning = true;
            detectLoop(videoElement);
        } catch (err) {
            console.error('Camera error:', err);
            throw err;
        }
    }

    // ─── Detection loop ───
    async function detectLoop(video) {
        if (!isRunning || !handsModel) return;

        try {
            await handsModel.send({ image: video });
        } catch (e) {
            // Skip frame
        }

        requestAnimationFrame(() => detectLoop(video));
    }

    // ─── Process hand landmarks ───
    function processResults(results, canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            return;
        }

        results.multiHandLandmarks.forEach((landmarks, handIndex) => {
            // Draw landmarks on overlay canvas
            drawHand(ctx, landmarks, canvas.width, canvas.height);

            // Recognize gesture
            const gesture = recognizeGesture(landmarks);
            if (gesture && gesture !== lastGesture) {
                const now = Date.now();
                if (now - lastGestureTime > GESTURE_COOLDOWN) {
                    lastGesture = gesture;
                    lastGestureTime = now;
                    if (onGestureCallback) onGestureCallback(gesture, landmarks);

                    // Reset after cooldown
                    setTimeout(() => { lastGesture = null; }, GESTURE_COOLDOWN);
                }
            }
        });
    }

    // ─── Draw hand skeleton ───
    function drawHand(ctx, landmarks, w, h) {
        const connections = [
            [0,1],[1,2],[2,3],[3,4],       // thumb
            [0,5],[5,6],[6,7],[7,8],       // index
            [0,9],[9,10],[10,11],[11,12],  // middle
            [0,13],[13,14],[14,15],[15,16],// ring
            [0,17],[17,18],[18,19],[19,20],// pinky
            [5,9],[9,13],[13,17],          // palm
        ];

        ctx.strokeStyle = 'rgba(0, 212, 255, 0.6)';
        ctx.lineWidth = 2;

        connections.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
            ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
            ctx.stroke();
        });

        // Draw points
        landmarks.forEach((lm, i) => {
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, i === 0 ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#00ff88' : '#00d4ff';
            ctx.fill();
        });
    }

    // ─── Gesture recognition (real landmark-based) ───
    function recognizeGesture(lm) {
        // Finger states (extended or not)
        const thumbExtended = lm[4].x < lm[3].x; // thumb tip left of IP (for right hand)
        const indexExtended = lm[8].y < lm[6].y;
        const middleExtended = lm[12].y < lm[10].y;
        const ringExtended = lm[16].y < lm[14].y;
        const pinkyExtended = lm[20].y < lm[18].y;

        const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

        // ── Fist (all fingers closed) ──
        if (extendedCount === 0 && !thumbExtended) {
            return 'fist';
        }

        // ── Open palm (all fingers extended) ──
        if (extendedCount === 4) {
            return 'open_palm';
        }

        // ── Point (only index extended) ──
        if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return 'point';
        }

        // ── Peace / V sign (index + middle) ──
        if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
            return 'peace';
        }

        // ── Thumbs up ──
        if (thumbExtended && extendedCount === 0 && lm[4].y < lm[3].y) {
            return 'thumbs_up';
        }

        // ── Pinch (thumb and index close together) ──
        const pinchDist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
        if (pinchDist < 0.05) {
            return 'pinch';
        }

        // ── Swipe detection (hand position changes) ──
        const palmX = lm[0].x;
        const palmY = lm[0].y;
        if (palmX < 0.2) return 'swipe_left';
        if (palmX > 0.8) return 'swipe_right';
        if (palmY < 0.2) return 'swipe_up';
        if (palmY > 0.8) return 'swipe_down';

        // ── Three fingers (spider-man) ──
        if (indexExtended && middleExtended && pinkyExtended && !ringExtended) {
            return 'three_fingers';
        }

        // ── OK sign (thumb and index form circle) ──
        if (pinchDist < 0.06 && middleExtended && ringExtended && pinkyExtended) {
            return 'ok_sign';
        }

        return null;
    }

    // ─── Get current hand landmarks (for recording) ───
    function getCurrentLandmarks() {
        // This is called externally to get the current frame's landmarks
        // The landmarks are passed through the callback
        return null; // Real-time via callback
    }

    // ─── Record a gesture template ───
    let recordingGesture = false;
    let recordedFrames = [];

    function startRecording() {
        recordingGesture = true;
        recordedFrames = [];
    }

    function captureFrame(landmarks) {
        if (!recordingGesture || !landmarks) return;
        // Store normalized landmark positions
        const frame = landmarks.map(lm => ({
            x: lm.x,
            y: lm.y,
            z: lm.z || 0,
        }));
        recordedFrames.push(frame);
    }

    function stopRecording() {
        recordingGesture = false;
        return recordedFrames;
    }

    // ─── Compare gesture template ───
    function compareTemplates(templateA, templateB) {
        if (!templateA.length || !templateB.length) return 0;

        // Average the frames to get a single 21-point template
        const avgA = averageLandmarks(templateA);
        const avgB = averageLandmarks(templateB);

        // Calculate average distance between corresponding landmarks
        let totalDist = 0;
        for (let i = 0; i < 21; i++) {
            totalDist += Math.hypot(
                avgA[i].x - avgB[i].x,
                avgA[i].y - avgB[i].y,
                (avgA[i].z || 0) - (avgB[i].z || 0)
            );
        }

        const avgDist = totalDist / 21;
        // Convert to similarity (0-1, where 1 = identical)
        return Math.max(0, 1 - avgDist * 10);
    }

    function averageLandmarks(frames) {
        const avg = [];
        for (let i = 0; i < 21; i++) {
            let x = 0, y = 0, z = 0;
            frames.forEach(f => {
                x += f[i].x;
                y += f[i].y;
                z += f[i].z || 0;
            });
            avg.push({
                x: x / frames.length,
                y: y / frames.length,
                z: z / frames.length,
            });
        }
        return avg;
    }

    // ─── Stop ───
    function stop() {
        isRunning = false;
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            cameraStream = null;
        }
        handsModel = null;
    }

    // ─── Basic fallback (no MediaPipe) ───
    function initBasic(video, canvas, callback) {
        // Simplified motion-based detection as fallback
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
                let prevFrame = null;

                isRunning = true;

                function detect() {
                    if (!isRunning) return;
                    requestAnimationFrame(detect);

                    ctx.drawImage(video, 0, 0, 320, 240);
                    const frame = ctx.getImageData(0, 0, 320, 240);

                    if (prevFrame) {
                        const motion = detectMotion(prevFrame, frame);
                        if (motion && motion.type) {
                            const now = Date.now();
                            if (now - lastGestureTime > GESTURE_COOLDOWN) {
                                lastGestureTime = now;
                                if (onGestureCallback) onGestureCallback(motion.type, null);
                            }
                        }
                    }
                    prevFrame = frame;
                }
                detect();
                resolve();
            } catch (e) {
                console.error('Basic detection failed:', e);
                resolve();
            }
        });
    }

    function detectMotion(prev, curr) {
        let totalDiff = 0;
        let leftDiff = 0, rightDiff = 0, topDiff = 0, bottomDiff = 0;
        const w = prev.width, h = prev.height;
        const halfW = w / 2, halfH = h / 2;

        for (let i = 0; i < prev.data.length; i += 16) {
            const diff = Math.abs(prev.data[i] - curr.data[i]) +
                         Math.abs(prev.data[i+1] - curr.data[i+1]) +
                         Math.abs(prev.data[i+2] - curr.data[i+2]);
            if (diff > 60) {
                totalDiff++;
                const px = (i / 4) % w;
                const py = Math.floor((i / 4) / w);
                if (px < halfW) leftDiff++;
                else rightDiff++;
                if (py < halfH) topDiff++;
                else bottomDiff++;
            }
        }

        if (totalDiff < 500) return null;

        if (leftDiff > rightDiff * 2) return { type: 'swipe_right' };
        if (rightDiff > leftDiff * 2) return { type: 'swipe_left' };
        if (topDiff > bottomDiff * 2) return { type: 'swipe_down' };
        if (bottomDiff > topDiff * 2) return { type: 'swipe_up' };

        return { type: 'open_palm' };
    }

    // Export
    window.JarvisGestures = {
        init,
        stop,
        startRecording,
        captureFrame,
        stopRecording,
        compareTemplates,
        recognizeGesture,
        isRunning: () => isRunning,
    };
})();
