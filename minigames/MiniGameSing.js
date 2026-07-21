// SING — pitch-matching minigame.
// Sing the solfège scale do re mi fa sol la si do (C4..C5) in order, within 22s.
// Uses getUserMedia + WebAudio AnalyserNode + autocorrelation pitch detection.
// Degrades to a "Microphone required!" fail modal when permission is denied.
class MiniGameSing extends Phaser.Scene {
    constructor() { super('MiniGameSing'); }

    init(data) { this.levelIndex = data.levelIndex ?? 4; }

    preload() { FeedbackFX.preload(this); }

    create() {
        const cx = this.scale.width / 2;
        this.done = false;
        this.listening = false;
        this.stopped = false;
        // Mic game: stop any background music and block the random-track
        // click chance for the whole scene (released in cleanup()).
        MusicFX.suppress(true);
        // Per-run token: the scene object is reused across restarts, so a stale
        // getUserMedia promise from a previous run must not touch this run.
        this.micSession = (this.micSession || 0) + 1;
        this.currentNote = 0;
        this.timeLimit = DevConfig.time(22);
        this.startTime = 0;

        // Solfège scale: do re mi fa sol la si do (C4 -> C5)
        this.names = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si', 'do'];
        this.freqs = [262, 294, 330, 349, 392, 440, 494, 523];
        // Dev: only require the first DevConfig.stages(8) notes (do, re).
        // The meter (buildMeter) still shows all 8 tick labels from this.names/this.freqs.
        this.targetNames = this.names.slice(0, DevConfig.stages(this.names.length));
        this.targetFreqs = this.freqs.slice(0, DevConfig.stages(this.freqs.length));

        // Detection tuning (dev: wider tolerance + shorter sustain = more chances)
        this.CENTS_TOL = DevConfig.on ? 75 : 40;      // "very close" = within ±40 cents (±75 in dev)
        this.SUSTAIN_MS = DevConfig.on ? 150 : 300;   // must hold the pitch ~300ms to register (~150ms in dev)
        this.PAUSE_MS = 400;      // detection pause after each hit (separate the notes)
        this.RMS_THRESHOLD = 0.01;
        this.sustainStart = null;
        this.detectUntil = 0;

        // Pitch meter geometry (log-frequency axis, roughly G3..E5)
        this.meterMinF = 196;     // G3
        this.meterMaxF = 659;     // E5
        this.meterX = 30;
        this.meterW = this.scale.width - 60;
        this.meterY = 780;

        // --- UI ---
        this.add.text(cx, 40, 'SING', { fontSize: '36px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(cx, 85, '', { fontSize: '18px', color: '#888' }).setOrigin(0.5);
        this.statusText = this.add.text(cx, 120, '🎤 Requesting microphone…', { fontSize: '16px', color: '#4ecca3' }).setOrigin(0.5);

        // Note targets (vertical list, current highlighted).
        // Built from the sliced target arrays so the list matches the actual
        // progression (2 rows in dev; identical to the full 8 in prod).
        this.noteRows = [];
        const startY = 175, stepY = 42;
        for (let i = 0; i < this.targetNames.length; i++) {
            const y = startY + i * stepY;
            const bg = this.add.rectangle(cx, y, 220, 36, 0x16213e).setStrokeStyle(2, 0x33334d);
            const txt = this.add.text(cx, y, `${this.targetNames[i]}   (${this.targetFreqs[i]} Hz)`, {
                fontSize: '18px', color: '#888888'
            }).setOrigin(0.5);
            this.noteRows.push({ bg, txt, hit: false });
        }

        this.buildMeter();
        this.refreshNotes();

        // Clean up audio when the scene stops/restarts/back-navigates.
        this.events.once('shutdown', this.cleanup, this);
        this.events.once('destroy', this.cleanup, this);

        this.setupMic();
    }

    // Build the static pitch-meter base, ticks and labels.
    buildMeter() {
        const g = this.add.graphics().setDepth(5);
        // meter bar
        g.fillStyle(0x0f0f23, 1).fillRoundedRect(this.meterX, this.meterY - 10, this.meterW, 20, 6);
        g.lineStyle(2, 0x33334d, 1).strokeRoundedRect(this.meterX, this.meterY - 10, this.meterW, 20, 6);
        // ticks + labels at each target note
        for (let i = 0; i < this.names.length; i++) {
            const x = this.freqToX(this.freqs[i]);
            g.lineStyle(2, 0x555577, 1);
            g.lineBetween(x, this.meterY - 12, x, this.meterY + 12);
            this.add.text(x, this.meterY + 22, this.names[i], { fontSize: '11px', color: '#666688' }).setOrigin(0.5, 0);
        }
        // marker showing where the current target sits
        this.targetMarker = this.add.triangle(0, this.meterY - 24, 0, 0, 12, 0, 6, 12, 0xffd166)
            .setOrigin(0.5, 0).setDepth(6);
        // moving pitch indicator (hidden until a pitch is detected)
        this.indicator = this.add.circle(this.meterX, this.meterY, 8, 0xffffff).setDepth(7).setVisible(false);
    }

    freqToX(f) {
        const lo = Math.log2(this.meterMinF);
        const hi = Math.log2(this.meterMaxF);
        let t = (Math.log2(f) - lo) / (hi - lo);
        t = Phaser.Math.Clamp(t, 0, 1);
        return this.meterX + t * this.meterW;
    }

    // Repaint note rows: hit = green, current = highlighted, upcoming = dim.
    refreshNotes() {
        for (let i = 0; i < this.noteRows.length; i++) {
            const row = this.noteRows[i];
            if (row.hit) {
                row.bg.setFillStyle(0x1f6f4a).setStrokeStyle(2, 0x4ecca3);
                row.txt.setColor('#4ecca3');
            } else if (i === this.currentNote) {
                row.bg.setFillStyle(0x2a2a4a).setStrokeStyle(2, 0xffd166);
                row.txt.setColor('#ffffff');
            } else {
                row.bg.setFillStyle(0x16213e).setStrokeStyle(2, 0x33334d);
                row.txt.setColor('#888888');
            }
        }
        if (this.currentNote < this.targetFreqs.length) {
            this.targetMarker.setVisible(true).x = this.freqToX(this.targetFreqs[this.currentNote]);
        } else {
            this.targetMarker.setVisible(false);
        }
    }

    setupMic() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) {
            this.fail('Microphone required!');
            return;
        }
        const session = this.micSession;
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
                // Scene may have been left (or restarted) while the permission prompt was open.
                if (session !== this.micSession || this.stopped || this.done || !this.sys.isActive()) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                this.stream = stream;
                const AC = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AC();
                if (this.audioCtx.state === 'suspended') { this.audioCtx.resume().catch(() => {}); }
                this.source = this.audioCtx.createMediaStreamSource(stream);
                this.analyser = this.audioCtx.createAnalyser();
                if (typeof this.analyser.getFloatTimeDomainData !== 'function') {
                    // Ancient WebKit: no float time-domain reads -> degrade per spec.
                    this.fail('Microphone required!'); // fail() runs cleanup()
                    return;
                }
                this.analyser.fftSize = 2048;
                this.source.connect(this.analyser);
                this.buffer = new Float32Array(this.analyser.fftSize);
                this.startTime = this.time.now;
                this.listening = true;
                this.statusText.setText(`🎤 Sing:  ${this.targetNames[this.currentNote]}`).setColor('#4ecca3');
            })
            .catch((err) => {
                // Scene may have been left (or restarted) while the permission prompt was open.
                if (session !== this.micSession || this.stopped || this.done || !this.sys.isActive()) return;
                // Surface the real error name — vital for diagnosing on-device failures.
                const detail = err && err.name ? ` (${err.name})` : '';
                this.fail(`Microphone required!${detail}`);
            });
    }

    // Standard ACF pitch detector on time-domain data. Returns Hz, or -1 if no clear pitch.
    autoCorrelate(buf, sampleRate) {
        const SIZE = buf.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) { rms += buf[i] * buf[i]; }
        rms = Math.sqrt(rms / SIZE);
        if (rms < this.RMS_THRESHOLD) return -1;

        // Trim near-silent edges of the window.
        let r1 = 0, r2 = SIZE - 1;
        const thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < thres) { r1 = i; break; } }
        for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; } }

        const trimmed = buf.slice(r1, r2);
        const n = trimmed.length;
        if (n === 0) return -1;

        const c = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n - i; j++) { c[i] += trimmed[j] * trimmed[j + i]; }
        }

        // Skip the initial downslope, then find the highest peak.
        let d = 0;
        while (d < n - 1 && c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < n; i++) {
            if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
        }
        if (maxpos <= 0) return -1;
        let T0 = maxpos;

        // Parabolic interpolation around the peak for sub-sample accuracy.
        if (T0 > 0 && T0 < n - 1) {
            const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
            const a = (x1 + x3 - 2 * x2) / 2;
            const b = (x3 - x1) / 2;
            if (a) T0 = T0 - b / (2 * a);
        }
        if (!(T0 > 0)) return -1;

        const freq = sampleRate / T0;
        // Reject implausible pitches: octave folding would otherwise map noise
        // artifacts (tiny/huge lags) straight into tolerance of the target.
        if (!isFinite(freq) || freq < 60 || freq > 1600) return -1;
        return freq;
    }

    // Fold detected freq into the nearest octave of the target, return signed cents.
    centsFromTarget(freq, target) {
        const octaves = Math.round(Math.log2(freq / target));
        const folded = freq / Math.pow(2, octaves);
        return 1200 * Math.log2(folded / target);
    }

    update() {
        if (this.done || !this.listening) return;

        const elapsed = (this.time.now - this.startTime) / 1000;
        const remaining = Math.max(0, this.timeLimit - elapsed);
        this.timerText.setText(`⏱ ${remaining.toFixed(1)}s`);
        if (remaining <= 0) {
            this.fail(`⏰ Time's up! Got ${this.currentNote}/${this.targetFreqs.length}`);
            return;
        }

        // Read time-domain samples and estimate loudness.
        this.analyser.getFloatTimeDomainData(this.buffer);
        let rms = 0;
        for (let i = 0; i < this.buffer.length; i++) { rms += this.buffer[i] * this.buffer[i]; }
        rms = Math.sqrt(rms / this.buffer.length);
        const hasSignal = rms > this.RMS_THRESHOLD;

        // Brief detection pause after a hit so the positive mp3 doesn't fool the detector.
        const paused = this.time.now < this.detectUntil;

        if (!hasSignal || paused) {
            this.indicator.setVisible(false);
            this.sustainStart = null;
            return;
        }

        const freq = this.autoCorrelate(this.buffer, this.audioCtx.sampleRate);
        if (freq <= 0) {
            this.indicator.setVisible(false);
            this.sustainStart = null;
            return;
        }

        const target = this.targetFreqs[this.currentNote];
        const cents = this.centsFromTarget(freq, target);
        const inTol = Math.abs(cents) <= this.CENTS_TOL;

        // Move + color the indicator.
        this.indicator.setVisible(true).x = this.freqToX(freq);
        this.indicator.setFillStyle(inTol ? 0x4ecca3 : 0xffffff);

        // Sustain check.
        if (inTol) {
            if (this.sustainStart === null) this.sustainStart = this.time.now;
            if (this.time.now - this.sustainStart >= this.SUSTAIN_MS) {
                this.registerNote();
            }
        } else {
            this.sustainStart = null;
        }
    }

    registerNote() {
        this.noteRows[this.currentNote].hit = true;
        this.sustainStart = null;
        this.detectUntil = this.time.now + this.PAUSE_MS;
        // Spec: no sounds in SING — positive images fountain from the pitch
        // indicator ("the ball") on each correctly hit note.
        FeedbackFX.fountain(this, this.indicator.x, this.meterY, true);
        this.indicator.setVisible(false);
        this.currentNote++;

        if (this.currentNote >= this.targetFreqs.length) {
            this.refreshNotes();
            this.win();
            return;
        }
        this.statusText.setText(`🎤 Sing:  ${this.targetNames[this.currentNote]}`);
        this.refreshNotes();
    }

    cleanup() {
        this.stopped = true;
        this.listening = false;
        MusicFX.suppress(false); // allow background music again
        if (this.indicator && this.indicator.active) this.indicator.setVisible(false);
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.source) {
            try { this.source.disconnect(); } catch (e) { /* ignore */ }
            this.source = null;
        }
        if (this.audioCtx) {
            try {
                const p = this.audioCtx.close();
                if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch (e) { /* ignore */ }
            this.audioCtx = null;
        }
        this.analyser = null;
    }

    fail(msg) {
        if (this.done) return;
        this.done = true;
        this.cleanup();

        const cx = this.scale.width / 2;
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(20).setStrokeStyle(2, 0xe63030);
        this.add.text(cx, 380, msg, { fontSize: '18px', color: '#e63030', align: 'center', wordWrap: { width: 260 } })
            .setOrigin(0.5).setDepth(21);
        // Re-request microphone access, then restart the scene on grant.
        this.add.text(cx, 430, '[ Allow microphone ]', {
            fontSize: '18px', color: '#1a1a2e', backgroundColor: '#4ecca3', padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.requestMic());
        this.add.text(cx, 478, '[ Retry ]', {
            fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 522, '[ Back ]', { fontSize: '18px', color: '#888' })
            .setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));

        // If the native re-request grants access, jump straight back in.
        this.onMicResult = (e) => {
            if (e && e.detail && e.detail.granted) this.scene.restart({ levelIndex: this.levelIndex });
        };
        window.addEventListener('micPermissionResult', this.onMicResult);
        this.events.once('shutdown', () => window.removeEventListener('micPermissionResult', this.onMicResult));
        this.events.once('destroy', () => window.removeEventListener('micPermissionResult', this.onMicResult));
    }

    requestMic() {
        if (window.Native && window.Native.requestMic) {
            window.Native.requestMic();
        } else {
            // Desktop / no bridge: just re-attempt via a scene restart.
            this.scene.restart({ levelIndex: this.levelIndex });
        }
    }

    win() {
        if (this.done) return;
        this.done = true;
        this.cleanup();

        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        const cx = this.scale.width / 2;
        this.statusText.setText('🎶 Perfect pitch!').setColor('#4ecca3');
        this.add.text(cx, 650, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
