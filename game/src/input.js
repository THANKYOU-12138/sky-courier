// input.js — the keyboard for Sky Courier: it tracks which keys are held and queues one-shot
// presses, and turns them into the stick, throttle and button signals the game reads.
// Design intent: the flight model never touches the DOM; it asks this module for a pitch and
// roll in [-1, 1], a throttle direction and whether a button was pressed since the last frame.
// Arrows fly the aeroplane (up climbs, as a new pilot expects), W/S work the throttle, Space
// drops a crate, Enter confirms, M mutes and R restarts.

const HELD_CODES = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
]);

export function createInput(target) {
  const held = new Set();
  const pressed = new Set();

  function onKeyDown(event) {
    if (HELD_CODES.has(event.code)) event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onBlur() {
    held.clear();
  }
  function onClick() {
    pressed.add('MouseConfirm');
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  target.addEventListener('pointerdown', onClick);

  const down = (code) => held.has(code);

  return {
    /** Stick pitch: +1 pulls the nose up (ArrowUp or the pilot's pull on S-free keys). */
    pitch() {
      return (down('ArrowUp') ? 1 : 0) - (down('ArrowDown') ? 1 : 0);
    },
    /** Stick roll: +1 banks right. */
    roll() {
      return (down('ArrowRight') || down('KeyD') ? 1 : 0) - (down('ArrowLeft') || down('KeyA') ? 1 : 0);
    },
    /** Throttle lever direction: +1 opens it (W), -1 closes it (S). */
    throttleDir() {
      return (down('KeyW') ? 1 : 0) - (down('KeyS') ? 1 : 0);
    },
    /** True while the drop button is held; the press itself is read with consume(). */
    dropHeld() {
      return down('Space');
    },
    /** Read and clear a one-shot press: 'Space', 'Enter', 'KeyM', 'KeyR' or 'MouseConfirm'. */
    consume(code) {
      const was = pressed.has(code);
      if (was) pressed.delete(code);
      return was;
    },
    /** Forget every queued press, used when a screen changes under the pilot's fingers. */
    flush() {
      pressed.clear();
    },
  };
}
