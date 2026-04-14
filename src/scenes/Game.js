import * as Phaser from 'phaser';
import ConveyorBelt from '../systems/ConveyorBelt.js';
import RobotFSM from '../systems/RobotFSM.js';
import ToolSystem from '../systems/ToolSystem.js';
import MachineRecipes from '../data/MachineRecipes.js';

export default class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        // reset recipe unlock state on new game
        MachineRecipes.reset();

        this.mistakes = 0;
        this.gears = 0;
        this.machinesCompleted = 0;

        // background grid lines for cyberpunk feel
        this._drawBackground();

        // core systems
        this.belt  = new ConveyorBelt(this);
        this.robot = new RobotFSM(this);
        this.tools = new ToolSystem(this);

        // ── belt → game ────────────────────────────────────────
        this.belt.onMachineArrived = (machine) => {
            this.tools.renderSlots(machine);
        };

        this.belt.onMachineCompleted = (machine) => {
            this.tools.clearSlots();
            this.machinesCompleted++;
            this.gears += machine.recipe.gearReward;
            this._updateHUD();

            // speed up slightly every 3 machines
            if (this.machinesCompleted % 3 === 0) {
                this.belt.increaseSpeed(8);
            }

            const unlocked = MachineRecipes.tryUnlock(this.gears);
            if (unlocked) {
                this.tools.unlock(unlocked.id);
                this._showUnlockBanner(unlocked.label);
            }
        };

        this.belt.onMachineLeft = () => {
            this.tools.clearSlots();
            this._registerMistake();
        };

        // ── tools → belt + mistake tracker ─────────────────────
        this.tools.onPartCompleted = (machine, partId) => {
            this.belt.completePart(machine, partId);
        };

        this.tools.onMistake = () => {
            this._registerMistake();
        };

        // ── HUD ─────────────────────────────────────────────────
        this._buildHUD();

        // ── pause ───────────────────────────────────────────────
        this.isPaused = false;
        this.input.keyboard.on('keydown-ESC', () => this._togglePause());
    }

    update(time, delta) {
        if (this.isPaused) return;
        this.belt.update(delta);

        // keep slots synced to moving machine
        if (this.belt.activeMachine) {
            this.tools.updateSlotPositions(this.belt.activeMachine);
        }
    }

    // ─── MISTAKE / DEATH ─────────────────────────────────────────────────────

    _registerMistake() {
        this.mistakes++;
        this._updateHUD();
        this.robot.advance(this.mistakes);

        if (this.mistakes >= 7) {
            this._triggerDeath();
        }
    }

    _triggerDeath() {
        // disable further input
        this.tools.clearSlots();
        this.input.keyboard.removeAllListeners();

        this.cameras.main.flash(300, 255, 0, 0);
        this.cameras.main.shake(500, 0.04);

        this.time.delayedCall(900, () => {
            this.scene.start('GameOver', {
                gears:    this.gears,
                machines: this.machinesCompleted,
            });
        });
    }

    // ─── HUD ─────────────────────────────────────────────────────────────────

    _buildHUD() {
        // top-left info
        this.gearsText = this.add.text(20, 20, 'Gears: 0', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 3,
        }).setDepth(20);

        this.mistakesText = this.add.text(20, 48, 'Mistakes: 0 / 7', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ff4400',
            stroke: '#000000',
            strokeThickness: 3,
        }).setDepth(20);

        this.machinesText = this.add.text(20, 76, 'Machines: 0', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#aaffee',
            stroke: '#000000',
            strokeThickness: 3,
        }).setDepth(20);

        // pause hint
        this.add.text(1260, 20, '[ESC] pause', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#444466',
        }).setOrigin(1, 0).setDepth(20);
    }

    _updateHUD() {
        this.gearsText.setText(`Gears: ${this.gears}`);
        this.mistakesText.setText(`Mistakes: ${this.mistakes} / 7`);
        this.machinesText.setText(`Machines: ${this.machinesCompleted}`);
    }

    // ─── UNLOCK BANNER ───────────────────────────────────────────────────────

    _showUnlockBanner(label) {
        const banner = this.add.text(640, 320, `⚙ UNLOCKED: ${label}`, {
            fontFamily: 'monospace',
            fontSize: '26px',
            color: '#00ffcc',
            backgroundColor: '#000000cc',
            padding: { x: 14, y: 8 },
            stroke: '#00ffcc',
            strokeThickness: 1,
        }).setOrigin(0.5).setDepth(40);

        this.tweens.add({
            targets: banner,
            alpha: 0,
            y: 280,
            duration: 2000,
            delay: 800,
            ease: 'Power1',
            onComplete: () => banner.destroy(),
        });
    }

    // ─── PAUSE ───────────────────────────────────────────────────────────────

    _togglePause() {
        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            this._pauseOverlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7)
                .setDepth(50);
            this._pauseLabel = this.add.text(640, 360, 'PAUSED\n\n[ESC] to resume', {
                fontFamily: 'monospace',
                fontSize: '36px',
                color: '#00ffcc',
                align: 'center',
            }).setOrigin(0.5).setDepth(51);
        } else {
            this._pauseOverlay?.destroy();
            this._pauseLabel?.destroy();
        }
    }

    // ─── BACKGROUND ──────────────────────────────────────────────────────────

    _drawBackground() {
        const g = this.add.graphics().setDepth(0).setAlpha(0.08);
        g.lineStyle(1, 0x00ffcc);

        // vertical lines
        for (let x = 0; x < 1280; x += 60) {
            g.beginPath();
            g.moveTo(x, 0);
            g.lineTo(x, 720);
            g.strokePath();
        }

        // horizontal lines
        for (let y = 0; y < 720; y += 60) {
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(1280, y);
            g.strokePath();
        }
    }
}
