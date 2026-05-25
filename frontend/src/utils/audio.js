let audioCtx = null;
let currentOscillator = null;
let currentInterval = null;

export const unlockAudio = () => {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(e => console.log('Audio resume failed', e));
    }
    return;
  }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Play a silent buffer to fully unlock on iOS/Safari/Chrome
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
    console.log('AudioContext successfully unlocked');
  } catch (e) {
    console.log('Audio context creation failed during unlock', e);
  }
};

export const playAlertBeep = () => {
  if (currentInterval) return; // already playing
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(e => console.warn('Failed to resume audioCtx:', e));
    }
    
    const playSiren = () => {
      if (!audioCtx || audioCtx.state === 'closed') return;
      
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      // High pitched siren alternating
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.5);

      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 1.0);
      
      currentOscillator = oscillator;
    };

    playSiren();
    currentInterval = setInterval(playSiren, 1000);
  } catch (err) {
    console.warn('Audio play failed:', err);
  }
};

export const stopAlertBeep = () => {
  if (currentInterval) {
    clearInterval(currentInterval);
    currentInterval = null;
  }
  if (currentOscillator) {
    try { currentOscillator.stop(); } catch (e) {}
    currentOscillator = null;
  }
  // NOTE: We deliberately do NOT close the audioCtx here.
  // Keeping the audioCtx alive ensures that once it is unlocked by a user gesture,
  // future plays (triggered asynchronously by sockets) will succeed without being blocked.
};

