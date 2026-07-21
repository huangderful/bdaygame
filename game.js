const config = {
    type: Phaser.AUTO,
    width: 390,
    height: 844,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    scene: [TitleScene, IntroScene, LevelSelectScene, ArchiveScene, SettingsScene, PartRevealScene, PartsScene, LetterScene, MiniGameMath, MiniGameArena, MiniGameGuess, MiniGameFlood, MiniGameSing, MiniGameOrbit, MiniGameDigFog, MiniGamePatience, MiniGameLockpick, MiniGameSpatial, MiniGameTickle, MiniGameFuseQuickdraw, MiniGameChase, MiniGameBike, MiniGameTrivia],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);

// Android back button support via browser history
window.addEventListener('popstate', () => {
    const current = game.scene.getScenes(true)[0];
    if (!current || current.scene.key === 'Title') {
        // Already at title, let Android handle it (exit app)
        return;
    }
    const toTitle = ['LevelSelect', 'Archive', 'Settings', 'Parts', 'Letter', 'Intro'];
    if (toTitle.includes(current.scene.key)) {
        current.scene.start('Title');
    } else {
        // In a minigame or part reveal — go back to level select
        current.scene.start('LevelSelect');
    }
});

// Push history state on every scene start so back button has something to pop.
// Also count minigame attempts (menu entries AND retries both re-run create).
game.events.on('ready', () => {
    game.scene.getScenes(false).forEach(scene => {
        scene.events.on('create', () => {
            if (scene.scene.key !== 'Title') {
                history.pushState({ scene: scene.scene.key }, '');
            }
            if (scene.scene.key.startsWith('MiniGame') && typeof scene.levelIndex === 'number') {
                let a = {};
                try { a = JSON.parse(localStorage.getItem('bdaygame_attempts')) || {}; } catch (e) {}
                a[scene.levelIndex] = (a[scene.levelIndex] || 0) + 1;
                localStorage.setItem('bdaygame_attempts', JSON.stringify(a));

                // Cumulative time-in-level: clock this visit from create to
                // shutdown (fires on win, fail-exit, retry AND back-navigation).
                const idx = scene.levelIndex;
                const enteredAt = Date.now();
                scene.events.once('shutdown', () => {
                    let t = {};
                    try { t = JSON.parse(localStorage.getItem('bdaygame_playtime')) || {}; } catch (e) {}
                    t[idx] = (t[idx] || 0) + (Date.now() - enteredAt);
                    localStorage.setItem('bdaygame_playtime', JSON.stringify(t));
                });
            }
        });
    });
});

const DEFAULT_LEVELS = [
    { name: 'MATH', completed: false, pageText: 'Ok now you can say you might beat me at math.' },
    { name: 'ARENA', completed: false, pageText: 'YOU SURVIVED LES GOOO' },
    { name: 'GUESS', completed: false, pageText: 'Hope you guessed me right the first time webs' },
    { name: 'FLOOD', completed: false, pageText: 'Just like the flood words coming out my mouth about how much I love you! Smartie. Or you just got lucky. Prolly both.' },
    { name: 'SING', completed: false, pageText: "I CANT BELIEVE you're actually ON PITCH??? WHAT… ya definitely cheated this one" },
    { name: 'ORBIT', completed: false, pageText: 'You\'re the center of my world! Muah' },
    { name: 'DIGFOG', completed: false, pageText: 'Welp, you did basically what my lefthand does all day.' },
    { name: 'PATIENCE', completed: false, pageText: "Ha… Ha…. someone said rotmg was easy :shrug: but it's about challenging as getting my heart ain't it :)" },
    { name: 'LOCKPICK', completed: false, pageText: "I should try lock picking again but I'm lazy" },
    { name: 'SPATIAL', completed: false, pageText: "Yeah, you try carrying a bag in my body, ain't no way you beat this without the freebie" },
    { name: 'TICKLE', completed: false, pageText: 'GONNA ATTACK MY WEBBBBSSSS, nice and easy one just like tickling my bebbums. I promise I stop mreow.' },
    { name: 'FUSE', completed: false, pageText: "No Vanessa! HARDER… TIGHTER… I'm SO CLOSE congratulations on unlocking my crotch! Chastity is no more." },
    { name: 'CHASE', completed: false, pageText: 'Good girl!' },
    { name: 'BIKE', completed: false, pageText: 'Ok 50 miles together now?' },
    { name: 'TRIVIA', completed: false, pageText: 'Gratz, learn anything new?' },
];

game.events.on('ready', () => {
    const saved = localStorage.getItem('bdaygame_levels');
    if (saved) {
        const parsed = JSON.parse(saved);
        const namesMatch = parsed.length === DEFAULT_LEVELS.length &&
            parsed.every((l, i) => l.name === DEFAULT_LEVELS[i].name);
        if (!namesMatch) {
            game.registry.set('levels', JSON.parse(JSON.stringify(DEFAULT_LEVELS)));
            localStorage.removeItem('bdaygame_levels');
        } else {
            // keep completion from the save, but always take quotes from code
            parsed.forEach((l, i) => { l.pageText = DEFAULT_LEVELS[i].pageText; });
            game.registry.set('levels', parsed);
        }
    } else {
        game.registry.set('levels', JSON.parse(JSON.stringify(DEFAULT_LEVELS)));
    }
});
