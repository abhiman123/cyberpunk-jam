export default class ToolSystem {
    constructor(scene) {
        this.scene = scene;
        this.selectedTool = null;
        this.slotGraphics = [];

        // callbacks — set from GameScene
        this.onPartCompleted = null;
        this.onMistake       = null;

        this.toolDefs = {
            wire:   { label: 'Wire',   color: 0x00ffcc, key: 'tool_wire'   },
            hammer: { label: 'Hammer', color: 0xffaa00, key: 'tool_hammer' },
            wrench: { label: 'Wrench', color: 0xff6600, key: 'tool_wrench' },
            solder: { label: 'Solder', color: 0xaaaaff, key: 'tool_solder' },
        };

        this.unlockedTools = ['wire', 'hammer'];
        this.toolButtons = {};

        this._renderToolbar();
    }

    // ─── HUD ─────────────────────────────────────────────────────────────────

    _renderToolbar() {
        // destroy old buttons
        Object.values(this.toolButtons).forEach(b => {
            b.bg?.destroy();
            b.label?.destroy();
            b.hotkey?.destroy();
        });
        this.toolButtons = {};

        // clear old keyboard listeners to avoid duplicates
        this.scene.input.keyboard.removeAllListeners();

        const startX = 50;
        const startY = 650;
        const spacing = 95;

        this.unlockedTools.forEach((toolId, i) => {
            const def = this.toolDefs[toolId];
            const x = startX + i * spacing;
            const hexColor = '#' + def.color.toString(16).padStart(6, '0');

            const bg = this.scene.add.rectangle(x, startY, 80, 70, 0x111122)
                .setStrokeStyle(2, def.color)
                .setInteractive({ useHandCursor: true })
                .setDepth(20);

            const label = this.scene.add.text(x, startY + 5, def.label, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: hexColor,
            }).setOrigin(0.5).setDepth(21);

            const hotkey = this.scene.add.text(x - 32, startY - 28, `[${i + 1}]`, {
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#555577',
            }).setDepth(21);

            bg.on('pointerdown', () => this.selectTool(toolId));

            this.scene.input.keyboard.on(`keydown-${i + 1}`, () => {
                this.selectTool(toolId);
            });

            this.toolButtons[toolId] = { bg, label, hotkey };
        });
    }

    selectTool(toolId) {
        // deselect previous
        if (this.selectedTool && this.toolButtons[this.selectedTool]) {
            this.toolButtons[this.selectedTool].bg.setFillStyle(0x111122);
        }

        this.selectedTool = toolId;

        // highlight selected
        const def = this.toolDefs[toolId];
        if (this.toolButtons[toolId]) {
            this.toolButtons[toolId].bg.setFillStyle(def.color, 0.25);
        }
    }

    unlock(toolId) {
        if (!this.unlockedTools.includes(toolId)) {
            this.unlockedTools.push(toolId);
            this._renderToolbar();
        }
    }

    // ─── SLOTS ───────────────────────────────────────────────────────────────

    renderSlots(machine) {
        this.clearSlots();

        machine.recipe.parts.forEach(part => {
            if (machine.completedParts.has(part.id)) return;

            const worldX = machine.sprite.x + part.slotX;
            const worldY = machine.sprite.y + part.slotY;
            const def = this.toolDefs[part.tool];
            const color = def?.color ?? 0xffffff;

            const slot = this.scene.add.rectangle(worldX, worldY, 22, 22, color, 0.3)
                .setStrokeStyle(1, color)
                .setInteractive({ useHandCursor: true })
                .setDepth(15);

            // pulse
            this.scene.tweens.add({
                targets: slot,
                alpha: { from: 0.3, to: 0.85 },
                duration: 550,
                yoyo: true,
                repeat: -1,
            });

            slot.on('pointerdown', () => this._attemptAction(machine, part, slot));
            slot.on('pointerover', () => this._showTooltip(part, worldX, worldY));
            slot.on('pointerout',  () => this._hideTooltip());

            // keep a reference so we can move the slot with the machine
            slot._part = part;
            slot._machine = machine;

            this.slotGraphics.push(slot);
        });
    }

    // call each frame to keep slots synced with moving machine
    updateSlotPositions(machine) {
        for (const slot of this.slotGraphics) {
            if (slot._machine === machine) {
                slot.x = machine.sprite.x + slot._part.slotX;
                slot.y = machine.sprite.y + slot._part.slotY;
            }
        }
    }

    clearSlots() {
        this.slotGraphics.forEach(s => s.destroy());
        this.slotGraphics = [];
        this._hideTooltip();
    }

    // ─── INTERACTION ─────────────────────────────────────────────────────────

    _attemptAction(machine, part, slotGraphic) {
        if (!this.selectedTool) {
            this._flashMessage('Select a tool first!', 0xff4400);
            return;
        }

        if (this.selectedTool === part.tool) {
            this._onSuccess(machine, part, slotGraphic);
        } else {
            this._onWrongTool(part);
        }
    }

    _onSuccess(machine, part, slotGraphic) {
        this._flashAt(slotGraphic.x, slotGraphic.y, this.toolDefs[part.tool]?.color ?? 0xffffff);

        this.scene.tweens.add({
            targets: slotGraphic,
            scaleX: 1.8,
            scaleY: 1.8,
            alpha: 0,
            duration: 180,
            onComplete: () => slotGraphic.destroy(),
        });

        this.slotGraphics = this.slotGraphics.filter(s => s !== slotGraphic);

        this.onPartCompleted?.(machine, part.id);
    }

    _onWrongTool(part) {
        const needed = this.toolDefs[part.tool]?.label ?? part.tool;
        this._flashMessage(`Wrong tool — need ${needed}`, 0xff2200);
        this.scene.cameras.main.shake(150, 0.008);
        this.onMistake?.();
    }

    // ─── FEEDBACK ────────────────────────────────────────────────────────────

    _flashMessage(text, color) {
        const hex = '#' + color.toString(16).padStart(6, '0');
        const msg = this.scene.add.text(640, 90, text, {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: hex,
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(30);

        this.scene.tweens.add({
            targets: msg,
            alpha: 0,
            y: 65,
            duration: 900,
            onComplete: () => msg.destroy(),
        });
    }

    _flashAt(x, y, color) {
        const dot = this.scene.add.circle(x, y, 10, color).setDepth(25);
        this.scene.tweens.add({
            targets: dot,
            scaleX: 3,
            scaleY: 3,
            alpha: 0,
            duration: 280,
            onComplete: () => dot.destroy(),
        });
    }

    _showTooltip(part, x, y) {
        this._hideTooltip();
        const needed = this.toolDefs[part.tool]?.label ?? part.tool;
        this._tooltip = this.scene.add.text(x, y - 30, `[${needed}]`, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#aaffee',
            backgroundColor: '#000000bb',
            padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(30);
    }

    _hideTooltip() {
        this._tooltip?.destroy();
        this._tooltip = null;
    }
}
