import * as Phaser from 'phaser';

/**
 * Shared drawing for the scanned floor-plan view (console, belt, bins, light,
 * bottom reference row: kiosk + 2×2 grid).
 */

export function redrawConveyorStrip(g, bounds, phase) {
    const { x, y, w, h } = bounds;
    g.clear();
    g.lineStyle(2, 0x2a3038, 0.9);
    const spacing = 24;
    const offset = (phase % 1) * spacing;
    for (let px = -spacing + offset; px < w + spacing; px += spacing) {
        g.beginPath();
        g.moveTo(x + px, y + 8);
        g.lineTo(x + px + 10, y + h - 8);
        g.strokePath();
    }
    g.lineStyle(1, 0x1e2228, 0.6);
    for (let i = 0; i < 5; i++) {
        const rx = x + 16 + (i * (w - 32)) / 4;
        g.strokeEllipse(rx, y + h / 2, 14, h - 20);
    }
}

export function drawStickFigurePreview(scene, cx, cy, scale, color, robo = false) {
    const g = scene.add.graphics();
    const s = scale * 4;
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy - 2.2 * s, 2.2 * s);
    g.fillRect(cx - 1.2 * s, cy - 0.2 * s, 2.4 * s, 5 * s);
    g.fillRect(cx - 2 * s, cy + 0.8 * s, 1.4 * s, 4.5 * s);
    g.fillRect(cx + 0.6 * s, cy + 0.8 * s, 1.4 * s, 4.5 * s);
    if (robo) {
        g.fillStyle(0x00ccff, 0.75);
        g.fillRect(cx - 1.8 * s, cy - 1 * s, 3.6 * s, 1.4 * s);
    } else {
        g.fillStyle(0x1a1a1a, 1);
        g.fillRect(cx - 1.1 * s, cy - 2.8 * s, 0.9 * s, 0.9 * s);
        g.fillRect(cx + 0.2 * s, cy - 2.8 * s, 0.9 * s, 0.9 * s);
    }
    return g;
}

export function buildNotification(scene, x, y, title, body) {
    const w = 312;
    const h = 64;
    scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x0a0a0a)
        .setStrokeStyle(1, 0x3a3530);
    scene.add.text(x + 14, y + 10, title, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#4a4540',
        letterSpacing: 3,
    });
    scene.add.text(x + 14, y + 28, body, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#7a7268',
        wordWrap: { width: w - 28 },
    });
}

export function buildConsoleBlock(scene, originX, originY) {
    const bodyW = 300;
    const bodyH = 400;
    scene.add.rectangle(originX + bodyW / 2, originY + bodyH / 2, bodyW, bodyH, 0x0e0e10)
        .setStrokeStyle(2, 0x252428);

    const monX = originX + 24;
    const monY = originY + 20;
    const monW = 188;
    const monH = 118;
    scene.add.rectangle(monX + monW / 2, monY + monH / 2, monW, monH, 0x060808)
        .setStrokeStyle(1, 0x1e2a28);
    drawStickFigurePreview(scene, monX + monW / 2, monY + monH / 2 + 8, 1.15, 0x5a8a80);

    const gridX = monX;
    const gridY = originY + 152;
    const cell = 74;
    const gap = 8;
    const variants = [
        { c: 0x6a5040, robo: false },
        { c: 0x4a6088, robo: true },
        { c: 0x5a6048, robo: false },
        { c: 0x3a4a70, robo: true },
    ];
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const i = row * 2 + col;
            const cx = gridX + col * (cell + gap) + cell / 2;
            const cy = gridY + row * (cell + gap) + cell / 2;
            scene.add.rectangle(cx, cy, cell, cell, 0x08080a).setStrokeStyle(1, 0x222226);
            drawStickFigurePreview(scene, cx, cy + 4, 0.55, variants[i].c, variants[i].robo);
        }
    }

    const colX = originX + 232;
    const colY = originY + 188;
    const actions = ['SCRAP', 'REPAIR', 'APPROVE'];
    actions.forEach((label, i) => {
        const cy = colY + i * 56;
        scene.add.circle(colX, cy, 7, 0x101012).setStrokeStyle(1, 0x333338);
        if (i === 2) {
            scene.add.circle(colX, cy, 4, 0x2a6a5a);
        }
        scene.add.text(colX + 18, cy - 8, label, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: i === 2 ? '#6a9a88' : '#4a4844',
            letterSpacing: 1,
        });
    });

    const hose = scene.add.graphics();
    hose.lineStyle(10, 0x1a1a1e, 1);
    hose.beginPath();
    hose.moveTo(originX + bodyW * 0.35, originY + bodyH);
    hose.lineTo(originX + bodyW * 0.35, originY + bodyH + 40);
    hose.lineTo(originX + bodyW * 0.55, originY + bodyH + 52);
    hose.strokePath();
}

export function buildPendantLight(scene, x, y) {
    const cord = scene.add.graphics();
    cord.lineStyle(2, 0x2a2a2e);
    cord.lineBetween(x, 0, x, y + 18);

    scene.add.ellipse(x, y + 28, 52, 22, 0x2a2824).setStrokeStyle(1, 0x3a3834);
    const bulb = scene.add.ellipse(x, y + 26, 28, 14, 0xfff4d4, 0.35);
    scene.add.ellipse(x, y + 32, 36, 10, 0x1a1814, 0.5);

    const cone = scene.add.graphics();
    const drawCone = (alpha) => {
        cone.clear();
        cone.fillStyle(0xffe8a0, alpha);
        cone.fillTriangle(x - 120, y + 140, x + 120, y + 140, x, y + 36);
    };
    drawCone(0.07);
    cone.setDepth(-1);

    scene.tweens.add({
        targets: bulb,
        alpha: 0.55,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
        onUpdate: () => drawCone(0.05 + bulb.alpha * 0.06),
    });
}

export function buildConveyorFrame(scene, x, y, w, h) {
    scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x121418).setStrokeStyle(1, 0x252830);
    const strip = scene.add.graphics();
    const bounds = { x, y, w, h };
    redrawConveyorStrip(strip, bounds, 0);
    scene.add.text(x + w / 2, y - 18, 'ROBOTS', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#3a3834',
        letterSpacing: 4,
    }).setOrigin(0.5);
    return { strip, bounds };
}

export function buildSortBins(scene, x, y, w, h) {
    const labels = ['BOX', 'PARTS', '?', 'SH'];
    const slotW = (w - 12) / 4;
    labels.forEach((label, i) => {
        const cx = x + 6 + slotW * i + slotW / 2;
        scene.add.rectangle(cx, y + h / 2, slotW - 8, h, 0x0c0c0e)
            .setStrokeStyle(1, 0x282420);
        scene.add.text(cx, y + h / 2, label, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#5a5448',
        }).setOrigin(0.5);
    });
}

/**
 * Bottom band from the sketch: angled kiosk (left) + isolated 2×2 grid (right).
 */
export function buildBottomReferenceRow(scene, y0) {
    const W = 1280;
    const pad = 40;
    const leftW = 420;
    const rightW = 420;
    const leftX = pad + leftW / 2;
    const rightX = W - pad - rightW / 2;
    const rowH = 156;

    scene.add.rectangle(W / 2, y0 + rowH / 2, W - 24, rowH + 16, 0x08080a)
        .setStrokeStyle(1, 0x1e1e22);

    scene.add.text(pad, y0 + 8, '// REFERENCE', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#353538',
        letterSpacing: 3,
    });

    const kx = pad;
    const ky = y0 + 28;
    const kw = 380;
    const kh = 118;
    const base = scene.add.graphics();
    base.fillStyle(0x151518);
    base.fillTriangle(kx - 12, ky + kh, kx + kw / 2, ky + kh + 12, kx + kw + 12, ky + kh);
    scene.add.rectangle(kx + kw / 2, ky + kh / 2 - 4, kw, kh, 0x101014)
        .setStrokeStyle(1, 0x2a2a30)
        .setRotation(-0.04);

    scene.add.text(kx + 20, ky + 12, 'TERMINAL', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#454048',
        letterSpacing: 2,
    }).setRotation(-0.04);
    const kLines = [
        '• Queue depth: nominal',
        '• Sort lanes armed',
        '• Awaiting classification',
    ];
    let ly = ky + 34;
    kLines.forEach((line) => {
        scene.add.text(kx + 20, ly, line, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#6a6258',
        }).setRotation(-0.04);
        ly += 22;
    });

    scene.add.text(rightX, y0 + 28, 'GRID VIEW', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#454048',
        letterSpacing: 2,
    }).setOrigin(0.5);

    const cell = 56;
    const gap = 10;
    const gridW = 2 * cell + gap;
    const gx0 = rightX - gridW / 2;
    const gy0 = y0 + 48;
    const gVariants = [
        { c: 0x6a5040, robo: false },
        { c: 0x4a6088, robo: true },
        { c: 0x5a6048, robo: false },
        { c: 0x3a4a70, robo: true },
    ];
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const i = row * 2 + col;
            const cx = gx0 + col * (cell + gap) + cell / 2;
            const cy = gy0 + row * (cell + gap) + cell / 2;
            scene.add.rectangle(cx, cy, cell, cell, 0x0a0a0c).setStrokeStyle(1, 0x2a2a30);
            drawStickFigurePreview(scene, cx, cy + 2, 0.42, gVariants[i].c, gVariants[i].robo);
        }
    }
}

export function buildRoomFrame(scene) {
    const g = scene.add.graphics();
    g.lineStyle(2, 0x2a2824, 0.85);
    g.strokeRect(16, 12, 1248, 488);
    scene.add.text(640, 28, 'PROCESSING FLOOR — LIVE', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#3a3632',
        letterSpacing: 4,
    }).setOrigin(0.5);
}
