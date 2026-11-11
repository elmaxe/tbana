// The sound's volume and mute on the start/pause screen (#volume in index.html), for touch screens
// as well as the keyboard's N. The Sound (src/sound.ts) keeps them between visits.

import type { Sound } from './sound';

export function mountVolume(container: HTMLElement, sound: Sound) {
  const button = container.querySelector('button')!;
  const slider = container.querySelector('input')!;
  const value = container.querySelector('output')!;

  const render = () => {
    container.classList.toggle('off', sound.silent);
    button.setAttribute('aria-pressed', String(sound.silent));
    slider.value = String(Math.round(sound.volume * 100));
    value.textContent = sound.muted ? 'Off' : `${slider.value}%`;
  };
  sound.onChange(render);
  render();

  slider.addEventListener('input', () => sound.setVolume(Number(slider.value) / 100));
  button.addEventListener('click', () => sound.setMuted(!sound.silent));
}
