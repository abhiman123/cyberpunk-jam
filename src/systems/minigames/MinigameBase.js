export default class MinigameBase {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = config;
        this.container = scene.add.container(0, 0).setDepth(config.depth ?? 180);
        this.container.setVisible(false);
        this.evidence = this._defaultEvidence();
        this.onClose = null;
        this.active = false;
    }

    _defaultEvidence() {
        return { symptoms: [], flags: [], completed: false };
    }

    show(caseData) {
        this.evidence = this._defaultEvidence();
        this.active = true;
        this._build(caseData);
        this.container.setVisible(true);
    }

    hide() {
        this.active = false;
        this.container.setVisible(false);
        this.container.removeAll(true);
    }

    emitEvidence(patch) {
        this.evidence = { ...this.evidence, ...patch };
    }

    close() {
        const out = this.evidence;
        this.hide();
        if (this.onClose) this.onClose(out);
    }

    destroy() {
        this.container.destroy();
    }

    _build(_caseData) { /* subclass */ }
}
