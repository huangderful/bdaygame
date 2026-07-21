// Victory flow: every minigame's win() routes here with { levelIndex }.
// Phase 1: the earned body part + the level's quote.
// Phase 2: the part flies onto the black outline alongside all previously
// earned parts, landing at its exact mapped position (PARTS_POSITIONS).

const PART_BY_LEVEL = [
    'head',       // 0  MATH
    'lefteye',    // 1  ARENA
    'righteye',   // 2  GUESSTHECHAR (placeholder)
    'mouth',      // 3  FLOOD
    'neck',       // 4  SING
    'leftarm',    // 5  ORBIT
    'lefthand',   // 6  DIGFOG
    'heart',      // 7  PATIENCE
    'rightarm',   // 8  LOCKPICK
    'righthand',  // 9  SPATIAL
    'stomach',    // 10 TICKLE (placeholder)
    'crotch',     // 11 FUSE
    'leftleg',    // 12 CHASE
    'rightleg',   // 13 BIKE
    'feet',       // 14 TRIVIA
];

const PART_LABELS = {
    head: 'THE HEAD', lefteye: 'THE LEFT EYE', righteye: 'THE RIGHT EYE',
    mouth: 'THE MOUTH', neck: 'THE NECK', leftarm: 'THE LEFT ARM',
    lefthand: 'THE LEFT HAND', heart: 'THE HEART', rightarm: 'THE RIGHT ARM',
    righthand: 'THE RIGHT HAND', stomach: 'THE STOMACH', crotch: 'THE CROTCH',
    leftleg: 'THE LEFT LEG', rightleg: 'THE RIGHT LEG', feet: 'THE FEET',
};

class PartRevealScene extends Phaser.Scene {
    constructor() { super('PartReveal'); }

    init(data) { this.levelIndex = data.levelIndex ?? 0; }

    preload() {
        FeedbackFX.preload(this);
        this.load.image('parts_outline', 'img/parts/outline.png');
        for (const p of PART_BY_LEVEL) {
            this.load.image(`part_${p}`, `img/parts/${p}.png`);
        }
        const part = PART_BY_LEVEL[this.levelIndex];
        this.load.image(`partlg_${part}`, `img/parts/${part}_lg.png`);
    }

    create() {
        this.part = PART_BY_LEVEL[this.levelIndex];
        this.levels = this.registry.get('levels') || [];
        this.phase = 'showcase';
        // Per-minigame victory audio — every win routes through this scene.
        // playWin stops any background song first (override).
        const levelName = this.levels[this.levelIndex]?.name;
        if (levelName) MusicFX.playWin(levelName);
        this.showShowcase();
    }

    earnedCount() {
        return this.levels.filter(l => isLevelCompleted(l)).length;
    }

    // ---- Phase 1: part + quote ----
    showShowcase() {
        const cx = 195;
        const quote = this.levels[this.levelIndex]?.pageText || '';

        this.add.text(cx, 90, 'PIECE RECOVERED', {
            fontSize: '14px', color: '#888', letterSpacing: 4
        }).setOrigin(0.5);
        this.add.text(cx, 125, PART_LABELS[this.part] || this.part.toUpperCase(), {
            fontSize: '26px', color: '#4ecca3', fontStyle: 'bold'
        }).setOrigin(0.5);

        const img = this.add.image(cx, 330, `partlg_${this.part}`);
        const s = Math.min(260 / img.width, 260 / img.height);
        img.setScale(s * 0.6).setAlpha(0);
        this.tweens.add({ targets: img, alpha: 1, scale: s, duration: 500, ease: 'Back.easeOut' });

        this.add.text(cx, 560, quote, {
            fontSize: '16px', color: '#ffffff', fontStyle: 'italic',
            align: 'center', wordWrap: { width: 320 }, lineSpacing: 6
        }).setOrigin(0.5);

        const hint = this.add.text(cx, 780, 'tap to continue', { fontSize: '14px', color: '#666' }).setOrigin(0.5);
        this.tweens.add({ targets: hint, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

        this.input.once('pointerdown', () => {
            if (this.phase !== 'showcase') return;
            this.phase = 'assembly';
            this.showAssembly();
        });
    }

    // ---- Phase 2: fly onto the outline with all earned parts ----
    showAssembly() {
        this.children.removeAll(true);
        const cx = 195;

        this.add.text(cx, 45, 'REBUILDING...', {
            fontSize: '16px', color: '#e63030', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(cx, 72, `${this.earnedCount()} / ${PART_BY_LEVEL.length} pieces`, {
            fontSize: '13px', color: '#888'
        }).setOrigin(0.5);

        // Outline centered, uniformly scaled. Parts were exported at the same
        // pixel scale as the outline, so one factor k positions AND sizes everything.
        const outline = this.add.image(cx, 450, 'parts_outline');
        const k = Math.min(340 / outline.width, 660 / outline.height);
        outline.setScale(k);
        const ox = cx - (outline.width * k) / 2;
        const oy = 450 - (outline.height * k) / 2;
        const ow = outline.width * k, oh = outline.height * k;

        const posOf = (part) => {
            const p = PARTS_POSITIONS[part];
            return { x: ox + p.fx * ow, y: oy + p.fy * oh };
        };

        // Pre-place every already-earned part except the one being revealed
        for (let i = 0; i < PART_BY_LEVEL.length; i++) {
            if (i === this.levelIndex) continue;
            if (!isLevelCompleted(this.levels[i])) continue;
            const part = PART_BY_LEVEL[i];
            const { x, y } = posOf(part);
            this.add.image(x, y, `part_${part}`).setScale(k);
        }

        // The new part flies in from center-screen, oversized, to its slot
        const { x: tx, y: ty } = posOf(this.part);
        const flying = this.add.image(cx, 380, `part_${this.part}`).setScale(k * 2.6).setDepth(10);
        this.flying = flying;
        this.flyTarget = { x: tx, y: ty, scale: k };

        this.tweens.add({
            targets: flying, x: tx, y: ty, scale: k,
            duration: 950, ease: 'Cubic.easeInOut',
            onComplete: () => {
                FeedbackFX.playPositive(this);
                FeedbackFX.fountain(this, tx, ty, true);
                const flash = this.add.circle(tx, ty, 14, 0xffffff, 0.9).setDepth(11);
                this.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 400, onComplete: () => flash.destroy() });

                const done = this.earnedCount() >= PART_BY_LEVEL.length;
                this.add.text(cx, 810, done ? 'HE IS WHOLE AGAIN' : 'tap to continue', {
                    fontSize: done ? '18px' : '14px',
                    color: done ? '#4ecca3' : '#666',
                    fontStyle: done ? 'bold' : 'normal'
                }).setOrigin(0.5);
                // Game beaten: the completion fanfare replaces the level's win audio.
                if (done) MusicFX.playWin('COMPLETION');
                // Final piece placed → celebrate on the Parts screen.
                this.input.once('pointerdown', () => this.scene.start(done ? 'Parts' : 'LevelSelect'));
            }
        });
    }
}
