'use client';

import {useSyncExternalStore} from 'react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';

const key = 'maison-sillage-intro-chime-v1';
const changeEvent = 'maison-chime-change';

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener('storage', onChange);
  return () => { window.removeEventListener(changeEvent, onChange); window.removeEventListener('storage', onChange); };
}
function getSnapshot() {
  try { return localStorage.getItem(key) !== 'done'; }
  catch { return true; }
}

function playCrystalChime() {
  const AudioContextClass = window.AudioContext;
  const context = new AudioContextClass();
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.value = 0.12;
  master.connect(context.destination);

  for (const [frequency, volume] of [[880, 0.45], [1320, 0.2], [1760, 0.08]] as const) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 1.7);
    oscillator.connect(envelope).connect(master);
    oscillator.start(now);
    oscillator.stop(now + 1.75);
  }
  window.setTimeout(() => void context.close(), 2_000);
}

export function IntroChime() {
  const t = useTranslations('chime');
  const visible = useSyncExternalStore(subscribe, getSnapshot, () => false);

  function dismiss(play: boolean) {
    if (play) {
      try { playCrystalChime(); } catch { /* Audio may be unavailable in this browser. */ }
    }
    try { localStorage.setItem(key, 'done'); } catch { /* Private browsing may block storage. */ }
    window.dispatchEvent(new Event(changeEvent));
  }

  if (!visible) return null;
  return <aside className="intro-chime" aria-label={t('label')}>
    <span aria-hidden="true">✧</span>
    <p>{t('prompt')}</p>
    <Button type="button" variant="ghost" size="sm" onClick={() => dismiss(true)}>{t('play')}</Button>
    <Button type="button" variant="ghost" size="sm" onClick={() => dismiss(false)}>{t('skip')}</Button>
  </aside>;
}
