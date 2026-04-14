import * as Phaser from 'phaser';

export default class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }

    init(data) {
        this.finalGears    = data.gears    ?? 0;
        this.finalMachines = data.machines ?? 0;
    }

    create() {
        const cx = 640;
        const cy = 360;

        // full dark overlay
        this.add.rectangle(cx, cy, 1280, 720, 0x000000, 0.94);

        // scanlines
        this._addScanlines();

        // title
        const title = this.add.text(cx, 160, 'SYSTEM FAILURE', {
            fontFamily: 'monospace',
            fontSize: '56px',
            color: '#ff0000',
            stroke: '#440000',
            strokeThickness: 4,
        }).setOrigin(0.5);

        this._flicker(title);

        // divider
        const div = this.add.graphics();
        div.lineStyle(1, 0xff2200, 0.5);
        div.beginPath();
        div.moveTo(200, 210);
        div.lineTo(1080, 210);
        div.strokePath();

        // stats
        this.add.text(cx, 260, `Machines completed:  ${this.finalMachines}`, {
            fontFamily: 'monospace',
            fontSize: '22px',
            color: '#aaffee',
        }).setOrigin(0.5);

        this.add.text(cx, 295, `Gears collected:     ${this.finalGears}`, {
            fontFamily: 'monospace',
            fontSize: '22px',
            color: '#ffcc00',
        }).setOrigin(0.5);

        // grade
        this._buildGrade(cx, 390);

        // restart prompt
        const prompt = this.add.text(cx, 570, '[ SPACE ] or [ CLICK ] to restart', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#555577',
        }).setOrigin(0.5);

        this.tweens.add({
            targets: prompt,
            alpha: 0,
            duration: 700,
            yoyo: true,
            repeat: -1,
        });

        // input to restart
        this.input.keyboard.once('keydown-SPACE', () => this._restart());
        this.input.once('pointerdown', () => this._restart());
    }

    _restart() {
        this.cameras.main.fade(400, 0, 0, 0, false, (cam, t) => {
            if (t === 1) this.scene.start('Game');
        });
    }

    _buildGrade(cx, y) {
        const grades = [
            { min: 200, label: 'S', color: '#ffdd00', msg: 'PERFECT OPERATIVE'  },
            { min: 100, label: 'A', color: '#00ffcc', msg: 'SKILLED WORKER'     },
            { min: 50,  label: 'B', color: '#aaffee', msg: 'ADEQUATE'           },
            { min: 20,  label: 'C', color: '#ff9900', msg: 'INEFFICIENT'        },
            { min: 0,   label: 'D', color: '#ff4400', msg: 'TERMINATED'         },
        ];

        const grade = grades.find(g => this.finalGears >= g.min) ?? grades.at(-1);

        this.add.text(cx, y, grade.label, {
            fontFamily: 'monospace',
            fontSize: '80px',
            color: grade.color,
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5);

        this.add.text(cx, y + 68, grade.msg, {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: grade.color,
        }).setOrigin(0.5);
    }

    _flicker(target) {
        const flick = () => {
            target.setAlpha(Math.random() > 0.12 ? 1 : 0.15);
            this.time.delayedCall(
                Phaser.Math.Between(40, 280),
                flick
            );
        };
        flick();
    }

    _addScanlines() {
        const g = this.add.graphics().setDepth(50).setAlpha(0.07);
        g.fillStyle(0x000000);
        for (let y = 0; y < 720; y += 4) {
            g.fillRect(0, y, 1280, 2);
        }
    }
}
