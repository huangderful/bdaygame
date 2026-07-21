class LevelSelectScene extends Phaser.Scene {
    constructor() { super('LevelSelect'); }

    preload() {
        this.load.image('parts_outline', 'img/parts/outline.png');
        for (const p of PART_BY_LEVEL) this.load.image(`part_${p}`, `img/parts/${p}.png`);
    }

    create() {
        // restore the page the user was on before entering a level
        this.page = this.registry.get('levelSelectPage') || 0;
        this.perPage = 2;
        this.levels = this.registry.get('levels') || [];
        this.totalPages = Math.ceil(this.levels.length / this.perPage);
        this.page = Math.min(this.page, this.totalPages - 1);

        // Swipe detection. swipeStartX must start null: a tap in the previous
        // scene (e.g. PartReveal's "tap to continue") leaks its pointerup into
        // this scene, and with swipeStartX=0 that read as a big right-swipe
        // that knocked the restored page back to page 1.
        this.swipeStartX = null;
        this.input.on('pointerdown', (p) => { this.swipeStartX = p.x; });
        this.input.on('pointerup', (p) => {
            if (this.swipeStartX === null) return;
            const dx = p.x - this.swipeStartX;
            this.swipeStartX = null;
            if (dx < -50 && this.page < this.totalPages - 1) { this.page++; this.savePage(); this.drawPage(); }
            else if (dx > 50 && this.page > 0) { this.page--; this.savePage(); this.drawPage(); }
        });

        this.drawPage();
    }

    drawPage() {
        this.children.removeAll(true);
        const cx = this.scale.width / 2;

        this.add.text(cx, 60, 'Select Level', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
        this.drawMiniOutline();

        const start = this.page * this.perPage;
        const end = Math.min(start + this.perPage, this.levels.length);

        for (let i = start; i < end; i++) {
            const idx = i - start;
            const y = 200 + idx * 260;
            const level = this.levels[i];
            const completed = isLevelCompleted(level);

            const rect = this.add.rectangle(cx, y, 300, 200, completed ? 0x0f3460 : 0x16213e)
                .setStrokeStyle(3, completed ? 0x4ecca3 : 0xe63030)
                .setInteractive({ useHandCursor: true });

            this.add.text(cx, y - 30, level?.name || `Level ${i + 1}`, { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
            this.add.text(cx, y + 20, completed ? '✓ Complete' : 'Tap to play', {
                fontSize: '16px', color: completed ? '#4ecca3' : '#888'
            }).setOrigin(0.5);

            // Show the body part this level awarded on the card
            if (completed && PART_BY_LEVEL[i]) {
                const img = this.add.image(cx + 105, y, `part_${PART_BY_LEVEL[i]}`);
                img.setScale(Math.min(70 / img.width, 70 / img.height));
            }

            // Attempts + cumulative time, just outside the card (above the reset link)
            const tries = this.getAttempts()[i] || 0;
            if (tries > 0) {
                const spent = formatPlaytime(getPlaytime()[i] || 0);
                this.add.text(cx, y + 112, `${tries} attempt${tries === 1 ? '' : 's'}  ·  ${spent}`, {
                    fontSize: '15px', color: '#999'
                }).setOrigin(0.5);
            }

            // Dev: per-level reset (removes completion + body part)
            if (DevConfig.on && completed) {
                this.add.text(cx, y + 130, '[ reset ]', { fontSize: '13px', color: '#e63030' })
                    .setOrigin(0.5).setInteractive({ useHandCursor: true })
                    .on('pointerdown', (p, lx, ly, event) => {
                        event.stopPropagation();
                        this.resetLevel(i);
                    });
            }

            rect.on('pointerdown', () => {
                const sceneMap = {
                    0: 'MiniGameMath', 1: 'MiniGameArena', 2: 'MiniGameGuess', 3: 'MiniGameFlood',
                    4: 'MiniGameSing', 5: 'MiniGameOrbit', 6: 'MiniGameDigFog', 7: 'MiniGamePatience',
                    8: 'MiniGameLockpick', 9: 'MiniGameSpatial', 10: 'MiniGameTickle',
                    11: 'MiniGameFuseQuickdraw', 12: 'MiniGameChase', 13: 'MiniGameBike',
                    14: 'MiniGameTrivia'
                };
                const target = sceneMap[i];
                if (!target) return;
                this.registry.set('levelSelectPage', this.page); // remember the page
                this.scene.start(target, { levelIndex: i });
            });
        }

        // Pagination — swipe to browse (arrows are hints, not buttons)
        this.add.text(cx, 726, `${this.page + 1} / ${this.totalPages}`, {
            fontSize: '16px', color: '#888'
        }).setOrigin(0.5);
        const left = this.page > 0 ? '◀' : ' ';
        const right = this.page < this.totalPages - 1 ? '▶' : ' ';
        this.add.text(cx, 754, `${left}   swipe   ${right}`, {
            fontSize: '15px', color: '#666'
        }).setOrigin(0.5);

        this.add.text(cx, 790, '[ Back ]', { fontSize: '20px', color: '#888' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('Title'));

        // Dev: global reset (wipes all completions + body parts)
        if (DevConfig.on) {
            this.add.text(cx, 830, '[ DEV: RESET ALL ]', { fontSize: '13px', color: '#e63030' })
                .setOrigin(0.5).setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.resetAll());
        }
    }

    // Scaled-down progress figure in the top right; tapping it opens the Parts screen.
    drawMiniOutline() {
        const outline = this.add.image(352, 62, 'parts_outline');
        const k = 90 / outline.height; // ~90px tall
        outline.setScale(k);
        const ox = outline.x - (outline.width * k) / 2;
        const oy = outline.y - (outline.height * k) / 2;
        const ow = outline.width * k, oh = outline.height * k;
        for (let i = 0; i < PART_BY_LEVEL.length; i++) {
            if (!isLevelCompleted(this.levels[i])) continue;
            const part = PART_BY_LEVEL[i];
            const p = PARTS_POSITIONS[part];
            this.add.image(ox + p.fx * ow, oy + p.fy * oh, `part_${part}`).setScale(k);
        }
        outline.setInteractive({ useHandCursor: true })
            .on('pointerdown', (p, lx, ly, event) => {
                event.stopPropagation();
                this.registry.set('levelSelectPage', this.page);
                this.scene.start('Parts');
            });
    }

    savePage() {
        this.registry.set('levelSelectPage', this.page);
    }

    // Per-level attempt counts — incremented in game.js on every minigame
    // scene create (menu entries AND retries), persisted separately from the
    // levels array so the name-match save check doesn't wipe them.
    // (getAttemptsMap respects the DEV_ALL_BEATEN display override.)
    getAttempts() {
        return getAttemptsMap();
    }

    saveLevels() {
        this.registry.set('levels', this.levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(this.levels));
    }

    resetLevel(i) {
        if (this.levels[i]) {
            this.levels[i].completed = false;
            this.saveLevels();
        }
        // Read RAW storage here (not the override-aware getters) — otherwise a
        // reset while DEV_ALL_BEATEN is on would wipe all real stats.
        let a = {}, t = {};
        try { a = JSON.parse(localStorage.getItem('bdaygame_attempts')) || {}; } catch (e) {}
        try { t = JSON.parse(localStorage.getItem('bdaygame_playtime')) || {}; } catch (e) {}
        delete a[i];
        delete t[i];
        localStorage.setItem('bdaygame_attempts', JSON.stringify(a));
        localStorage.setItem('bdaygame_playtime', JSON.stringify(t));
        this.drawPage();
    }

    resetAll() {
        for (const l of this.levels) if (l) l.completed = false;
        this.saveLevels();
        localStorage.removeItem(INTRO_SEEN_KEY); // intro plays again on next Play
        localStorage.removeItem('bdaygame_attempts');
        localStorage.removeItem('bdaygame_playtime');
        this.registry.set('levelSelectPage', 0);
        this.drawPage();
    }
}
