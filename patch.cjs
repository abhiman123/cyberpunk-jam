const fs = require('fs');
let code = fs.readFileSync('src/scenes/Game.js', 'utf-8');

// 1. _buildConveyorScreen mainViewLayers
code = code.replace(
`        mainViewLayerKeys.forEach((key) => {
            if (!this.textures.exists(key)) return;
            const layer = this.add.image(640, 360, key).setDisplaySize(1280, 720);
            this._conveyorContainer.add(layer);
        });`,
`        this._mainViewLayers = {};
        mainViewLayerKeys.forEach((key) => {
            if (!this.textures.exists(key)) return;
            
            let layer;
            if (key === 'mainview_bottom' || key === 'mainview_second') {
                const texFrame = this.textures.getFrame(key);
                layer = this.add.tileSprite(640, 360, texFrame.width, texFrame.height, key).setDisplaySize(1280, 720);
            } else {
                layer = this.add.image(640, 360, key).setDisplaySize(1280, 720);
            }
            
            this._conveyorContainer.add(layer);
            this._mainViewLayers[key] = layer;
        });`
);

// 2. _animateUnitArrival
code = code.replace(
`        this._unitMoveTween?.stop();
        this._unitMoveTween = null;

        this._unitMoveTween = this.tweens.add({
            targets: this._unitContainer,`,
`        this._unitMoveTween?.stop();
        this._unitMoveTween = null;
        this._conveyorAnimTween?.stop();
        this._conveyorAnimTween = null;

        const conveyorLayers = [this._mainViewLayers?.mainview_bottom, this._mainViewLayers?.mainview_second].filter(Boolean);
        if (conveyorLayers.length > 0) {
            this._conveyorAnimTween = this.tweens.add({
                targets: conveyorLayers,
                tilePositionX: \`+=\${travelDistance}\`,
                duration: tweenDurationMs,
                ease: 'Linear',
            });
        }

        this._unitMoveTween = this.tweens.add({
            targets: this._unitContainer,`
);

// 3. _playCurrentUnitExitAnimation
code = code.replace(
`            : {
                targets: this._unitContainer,
                x: 1490,
                duration: 500,
                ease: 'Cubic.In',
            };

        this.tweens.add({
            ...exitTween,
            onComplete,
        });`,
`            : {
                targets: this._unitContainer,
                x: 1490,
                duration: 500,
                ease: 'Cubic.In',
            };

        if (this._pendingExitAction !== 'scrap') {
            const travelDistance = Math.abs(1490 - this._unitContainer.x);
            const conveyorLayers = [this._mainViewLayers?.mainview_bottom, this._mainViewLayers?.mainview_second].filter(Boolean);
            if (conveyorLayers.length > 0) {
                this._conveyorAnimTween?.stop();
                this._conveyorAnimTween = this.tweens.add({
                    targets: conveyorLayers,
                    tilePositionX: \`-=\${travelDistance}\`,
                    duration: 500,
                    ease: 'Linear',
                });
            }
        }

        this.tweens.add({
            ...exitTween,
            onComplete,
        });`
);

// 4. _refreshFactoryActionButtons
code = code.replace(
`        const readyAlpha = canInteract ? 1 : (hasUnit ? 0.68 : 0.38);
        const gatedAlpha = canInteract ? 0.62 : (hasUnit ? 0.52 : 0.38);
        const acceptOverrideReady = Boolean(this._pendingUnsafeAcceptConfirmation) && hasUnit;

        Object.entries(this._conveyorRulingButtons).forEach(([action, button]) => {
            const alpha = action === 'scrap'
                ? readyAlpha
                : ((gateState.ready || acceptOverrideReady) ? readyAlpha : gatedAlpha);
            button.bgRect.setAlpha(alpha);
        });`,
`        const readyAlpha = canInteract ? 1 : (hasUnit ? 0.95 : 0.85);
        const gatedAlpha = canInteract ? 0.9 : (hasUnit ? 0.85 : 0.75);
        const acceptOverrideReady = Boolean(this._pendingUnsafeAcceptConfirmation) && hasUnit;

        Object.entries(this._conveyorRulingButtons).forEach(([action, button]) => {
            const isReady = (action === 'scrap') || gateState.ready || acceptOverrideReady;
            const alpha = isReady ? readyAlpha : gatedAlpha;
            button.bgRect.setAlpha(alpha);
            
            if (isReady && canInteract) {
                button.bgRect.clearTint();
            } else {
                button.bgRect.setTint(0x778899);
            }
        });`
);

// 5. _setConveyorRulingButtonsVisible
code = code.replace(
`            button.bgRect.setAlpha(isActive ? 1 : 0.35);`,
`            button.bgRect.setAlpha(isActive ? 1 : 0.85);`
);

// 6. _buildDeskItems
code = code.replace(
`        inputZone.on('pointerdown', () => {
            if (this._gameplayPaused) return;
            if (item.type === 'rulebook') {
                this._toggleRulebookTablet();
            } else if (item.type === 'phone') {
                this._togglePhonePanel();
            }
        });

        item.inputZone = inputZone;`,
`        inputZone.on('pointerdown', () => {
            if (this._gameplayPaused) return;
            if (item.type === 'rulebook') {
                this._toggleRulebookTablet();
            } else if (item.type === 'phone') {
                this._togglePhonePanel();
            }
        });

        if (item.type === 'photo') {
            inputZone.setInteractive({ draggable: true });
            this.input.setDraggable(inputZone);
            
            inputZone.on('dragstart', () => {
                if (this._gameplayPaused) return;
                item.dragging = true;
                this._syncDeskItemFocusState(item);
                this._deskContainer.bringToTop(container);
            });
            
            inputZone.on('drag', (pointer, dragX, dragY) => {
                if (this._gameplayPaused) return;
                container.x += pointer.position.x - pointer.prevPosition.x;
                container.y += pointer.position.y - pointer.prevPosition.y;
            });
            
            inputZone.on('dragend', () => {
                item.dragging = false;
                this._syncDeskItemFocusState(item);
            });
        }

        item.inputZone = inputZone;`
);

fs.writeFileSync('src/scenes/Game.js', code);
