// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — Sound Engine
// Procedural sci-fi UI sounds (no audio files needed)
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    let audioCtx = null;
    let masterGain = null;
    let enabled = true;

    function init() {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.3;
            masterGain.connect(audioCtx.destination);
        } catch (e) {
            enabled = false;
        }
    }

    function ensureContext() {
        if (!audioCtx) init();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        return enabled && audioCtx;
    }

    // ─── Click / Tap ───
    function click() {
        if (!ensureContext()) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    }

    // ─── Hover ───
    function hover() {
        if (!ensureContext()) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.03);
    }

    // ─── Navigation / Section Change ───
    function navigate() {
        if (!ensureContext()) return;
        const t = audioCtx.currentTime;
        [0, 0.06, 0.12].forEach((delay, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600 + i * 200, t + delay);
            gain.gain.setValueAtTime(0.1, t + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.1);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(t + delay);
            osc.stop(t + delay + 0.1);
        });
    }

    // ─── Exploder / Part Select ───
    function explode() {
        if (!ensureContext()) return;
        const t = audioCtx.currentTime;
        // Whoosh sound
        const noise = audioCtx.createBufferSource();
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.15));
        }
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, t);
        filter.frequency.exponentialRampToValueAtTime(500, t + 0.3);
        filter.Q.value = 2;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(t);
    }

    // ─── Success / Confirm ───
    function success() {
        if (!ensureContext()) return;
        const t = audioCtx.currentTime;
        [523, 659, 784].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, t + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(t + i * 0.08);
            osc.stop(t + i * 0.08 + 0.15);
        });
    }

    // ─── Error ───
    function error() {
        if (!ensureContext()) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.setValueAtTime(150, t + 0.1);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 0.25);
    }

    // ─── Ambient hum (continuous) ───
    let ambientOsc = null;
    let ambientGain = null;

    function startAmbient() {
        if (!ensureContext()) return;
        if (ambientOsc) return;
        ambientOsc = audioCtx.createOscillator();
        ambientGain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        ambientOsc.type = 'sawtooth';
        ambientOsc.frequency.value = 55;
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        ambientGain.gain.value = 0.02;
        ambientOsc.connect(filter);
        filter.connect(ambientGain);
        ambientGain.connect(masterGain);
        ambientOsc.start();
    }

    function stopAmbient() {
        if (ambientOsc) {
            ambientOsc.stop();
            ambientOsc = null;
            ambientGain = null;
        }
    }

    // ─── Scan sound ───
    function scan() {
        if (!ensureContext()) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(1600, t + 0.5);
        osc.frequency.exponentialRampToValueAtTime(400, t + 1.0);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.setValueAtTime(0.08, t + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + 1.0);
    }

    // ─── Toggle ───
    function toggle() {
        enabled = !enabled;
        if (masterGain) masterGain.gain.value = enabled ? 0.3 : 0;
        return enabled;
    }

    window.JarvisSounds = {
        init, click, hover, navigate, explode, success, error,
        scan, startAmbient, stopAmbient, toggle,
        isEnabled: () => enabled,
    };
})();
