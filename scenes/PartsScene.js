// PARTS — a vertically scrollable page.
// Section 1 (first screenful): the black outline with every earned piece
// placed on it + the "N / 15 pieces" counter. When ALL parts are collected
// the title becomes "HAPPY BIRTHDAY WEBS!" and clean taps (not scroll drags) on
// that section are judged: ON the figure = positive fountain from the
// finger, off = negative.
// Then one section per part in level order: earned parts show their large
// image, name and level quote; unearned ones show a giant "?" and "???".
// Drag to scroll (with momentum, LetterScene pattern). Back stays fixed.
class PartsScene extends Phaser.Scene {
    constructor() { super('Parts'); }

    preload() {
        FeedbackFX.preload(this);
        this.load.image('parts_outline', 'img/parts/outline.png');
        for (const p of PART_BY_LEVEL) {
            this.load.image(`part_${p}`, `img/parts/${p}.png`);
            this.load.image(`partlg_${p}`, `img/parts/${p}_lg.png`);
        }
    }

    create() {
        const cx = 195, H = 844;
        this.levels = this.registry.get('levels') || [];
        const earned = this.levels.filter(l => isLevelCompleted(l)).length;
        this.complete = earned >= PART_BY_LEVEL.length;

        // Everything except the Back button lives in this scrolling container.
        this.content = this.add.container(0, 0);

        // ---- Section 1: header + counter + outline with earned parts ----
        this.section1Height = H;
        this.content.add(this.add.text(cx, 45, this.complete ? 'HAPPY BIRTHDAY WEBS!' : 'PARTS', {
            fontSize: this.complete ? '24px' : '22px',
            color: this.complete ? '#4ecca3' : '#e63030', fontStyle: 'bold'
        }).setOrigin(0.5));
        this.content.add(this.add.text(cx, 75, `${earned} / ${PART_BY_LEVEL.length} pieces`, {
            fontSize: '13px', color: '#888'
        }).setOrigin(0.5));

        // Outline + earned parts, same layout math as PartRevealScene.
        this.outline = null;
        this.k = 1;
        if (this.textures.exists('parts_outline')) {
            this.outline = this.add.image(cx, 450, 'parts_outline');
            this.k = Math.min(340 / this.outline.width, 660 / this.outline.height);
            this.outline.setScale(this.k);
            this.content.add(this.outline);

            const ox = cx - (this.outline.width * this.k) / 2;
            const oy = 450 - (this.outline.height * this.k) / 2;
            const ow = this.outline.width * this.k, oh = this.outline.height * this.k;
            for (let i = 0; i < PART_BY_LEVEL.length; i++) {
                if (!isLevelCompleted(this.levels[i])) continue;
                const part = PART_BY_LEVEL[i];
                const pos = PARTS_POSITIONS[part];
                if (!pos || !this.textures.exists(`part_${part}`)) continue;
                this.content.add(
                    this.add.image(ox + pos.fx * ow, oy + pos.fy * oh, `part_${part}`).setScale(this.k)
                );
            }
        }

        // Scroll hint — inside the container so it scrolls away naturally.
        const hint = this.add.text(cx, 768, '⌄ scroll ⌄', {
            fontSize: '14px', color: '#666'
        }).setOrigin(0.5);
        this.content.add(hint);
        this.tweens.add({ targets: hint, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

        // ---- Sections 2..16: one per part in level order ----
        let y = this.section1Height;
        for (let i = 0; i < PART_BY_LEVEL.length; i++) {
            y = this.buildPartSection(i, y);
        }
        this.contentHeight = y + 30;

        // ---- Drag to scroll with momentum (LetterScene pattern) ----
        this.scrollY = 0;
        this.maxScroll = Math.max(0, this.contentHeight - H);
        this.velocity = 0;
        this.lastY = null;
        this.downPos = null;

        this.input.on('pointerdown', (p) => {
            this.lastY = p.y;
            this.velocity = 0;
            this.downPos = { x: p.x, y: p.y };
        });
        this.input.on('pointermove', (p) => {
            if (!p.isDown || this.lastY === null) return;
            const dy = p.y - this.lastY;
            this.lastY = p.y;
            this.velocity = -dy;
            this.scroll(this.scrollY - dy);
        });
        this.input.on('pointerup', (p) => {
            this.lastY = null;
            const down = this.downPos;
            this.downPos = null;
            if (!down || !this.complete) return;
            // Only judge clean taps, not scroll drags.
            if (Phaser.Math.Distance.Between(down.x, down.y, p.x, p.y) > 10) return;
            if (p.y > 780) return; // leave the Back button zone alone
            // Only judge while the tap lands within the outline section.
            if (p.y + this.scrollY > this.section1Height) return;
            const hit = this.isOnOutline(p.x, p.y);
            if (hit) FeedbackFX.playPositive(this); else FeedbackFX.playNegative(this);
            FeedbackFX.fountain(this, p.x, p.y, hit);
            // Easter egg: every 22nd tap ON the figure replays the completion fanfare.
            if (hit) {
                this.outlineTaps = (this.outlineTaps || 0) + 1;
                if (this.outlineTaps % 22 === 0) MusicFX.playWin('COMPLETION');
            }
        });

        // Back stays fixed — not in the container. stopPropagation keeps it
        // from starting a scroll drag or being judged.
        const back = this.add.text(cx, 815, '[ Back ]', {
            fontSize: '18px', color: '#888', backgroundColor: '#1a1a2e', padding: { x: 10, y: 4 }
        }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });
        back.on('pointerdown', (p, lx, ly, event) => {
            event.stopPropagation();
            this.scene.start('Title');
        });
    }

    // One per-part section starting at content-space y; returns the next y.
    buildPartSection(i, y) {
        const cx = 195;
        const part = PART_BY_LEVEL[i];
        const level = this.levels[i] || {};

        // divider + level name (from the registry levels array)
        this.content.add(this.add.rectangle(cx, y, 330, 1, 0x2e2e4e).setOrigin(0.5, 0));
        y += 34;
        const label = this.add.text(cx, y, `LEVEL ${i + 1} — ${level.name || '???'}`, {
            fontSize: '17px', color: '#aaa', letterSpacing: 2, fontStyle: 'bold'
        }).setOrigin(0.5, 0);
        this.content.add(label);
        y += label.height + 10;

        // attempts + cumulative time on this level
        const tries = getAttemptsMap()[i] || 0;
        const ms = getPlaytime()[i] || 0;
        if (tries > 0 || ms > 0) {
            const stats = this.add.text(cx, y,
                `${tries} attempt${tries === 1 ? '' : 's'}  ·  ${formatPlaytime(ms)}`, {
                fontSize: '15px', color: '#7777aa'
            }).setOrigin(0.5, 0);
            this.content.add(stats);
            y += stats.height + 14;
        } else {
            y += 10;
        }

        if (isLevelCompleted(level)) {
            // Prefer the large image; fall back to the small one if missing.
            const lgKey = `partlg_${part}`;
            const imgKey = this.textures.exists(lgKey) ? lgKey
                : (this.textures.exists(`part_${part}`) ? `part_${part}` : null);
            if (imgKey) {
                const img = this.add.image(cx, y, imgKey).setOrigin(0.5, 0);
                const s = Math.min(240 / img.width, 240 / img.height);
                img.setScale(s);
                this.content.add(img);
                y += img.height * s + 20;
            }
            const name = this.add.text(cx, y, PART_LABELS[part] || part.toUpperCase(), {
                fontSize: '20px', color: '#4ecca3', fontStyle: 'bold'
            }).setOrigin(0.5, 0);
            this.content.add(name);
            y += name.height + 14;
            const quote = this.add.text(cx, y, level.pageText || '', {
                fontSize: '15px', color: '#ffffff', fontStyle: 'italic',
                align: 'center', wordWrap: { width: 320 }, lineSpacing: 6
            }).setOrigin(0.5, 0);
            this.content.add(quote);
            y += quote.height + 44;
        } else {
            const big = this.add.text(cx, y, '?', {
                fontSize: '80px', color: '#3a3a5c', fontStyle: 'bold'
            }).setOrigin(0.5, 0);
            this.content.add(big);
            y += big.height + 10;
            const sub = this.add.text(cx, y, '???', {
                fontSize: '16px', color: '#555'
            }).setOrigin(0.5, 0);
            this.content.add(sub);
            y += sub.height + 44;
        }
        return y;
    }

    scroll(v) {
        this.scrollY = Phaser.Math.Clamp(v, 0, this.maxScroll);
        this.content.y = -this.scrollY;
    }

    update() {
        if (this.lastY === null && Math.abs(this.velocity) > 0.5) {
            this.scroll(this.scrollY + this.velocity);
            this.velocity *= 0.95;
        }
    }

    // True if a screen-space tap lands on an opaque pixel of the outline
    // image (the body), accounting for the current scroll offset.
    isOnOutline(x, y) {
        if (!this.outline) return false;
        const cy = y + this.scrollY; // content-space y (container only moves vertically)
        const tx = Math.round((x - this.outline.x) / this.k + this.outline.width / 2);
        const ty = Math.round((cy - this.outline.y) / this.k + this.outline.height / 2);
        if (tx < 0 || ty < 0 || tx >= this.outline.width || ty >= this.outline.height) return false;
        return this.textures.getPixelAlpha(tx, ty, 'parts_outline') > 32;
    }
}
