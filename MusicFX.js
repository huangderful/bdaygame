// Background music manager (plain HTML5 Audio — spans scenes, no preload).
// - On every click/tap: 2% chance to start a random track from music/
//   (NEVER the opening) — but 0% if anything is already playing, and 0%
//   while suppressed (the SING minigame suppresses: music would bleed into
//   the mic and break pitch detection).
// - MusicFX.playOpening() is called by the first-play intro slideshow.
const MusicFX = {
    TRACKS: ['ballz', 'coconutmall', 'corduroy', 'diewithasmile', 'mario',
             'penis', 'purple', 'recuerdame', 'sleep', 'sunshine', 'symphony'],
    CHANCE: 0.02,
    current: null,
    suppressed: false,

    init() {
        // Capture-phase so it sees taps regardless of what Phaser does with them.
        document.addEventListener('pointerdown', () => this.maybePlay(), { capture: true });
    },

    isPlaying() {
        return !!(this.current && !this.current.paused && !this.current.ended);
    },

    maybePlay() {
        if (this.suppressed || this.isPlaying()) return;
        if (Math.random() >= this.CHANCE) return;
        this.play(this.TRACKS[Math.floor(Math.random() * this.TRACKS.length)]);
    },

    play(name) {
        this.stop();
        const a = new Audio(`music/${name}.mp3`);
        a.addEventListener('ended', () => { if (this.current === a) this.current = null; });
        this.current = a;
        a.play().catch(() => { if (this.current === a) this.current = null; });
    },

    playOpening() { this.play('opening'); },

    // Per-minigame victory audio (winaudio/<LEVELNAME>.mp3). Overrides any
    // background song: play() stops whatever is currently playing first.
    playWin(levelName) {
        this.stop();
        const a = new Audio(`winaudio/${levelName}.mp3`);
        a.addEventListener('ended', () => { if (this.current === a) this.current = null; });
        this.current = a;
        a.play().catch(() => { if (this.current === a) this.current = null; });
    },

    stop() {
        if (this.current) {
            try { this.current.pause(); } catch (e) { /* ignore */ }
            this.current = null;
        }
    },

    // SING: no random tracks may start, and anything playing stops (mic game).
    suppress(on) {
        this.suppressed = on;
        if (on) this.stop();
    },
};
MusicFX.init();
