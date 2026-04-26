/**
 * Tiny finite-state token used by the conveyor / case flow.
 * (Phaser scenes only need a label + one-way edges.)
 */
export default class StateMachine {
    /** @param {string} [initial] */
    constructor(initial = 'intake') {
        this.state = initial;
    }

    /** @param {string} next */
    transition(next) {
        this.state = next;
    }
}
