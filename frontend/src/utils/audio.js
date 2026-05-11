let audioCtx = null;
let currentOscillator = null;
let currentInterval = null;

export const playAlertBeep = () => {
  if (currentInterval) return; // already playing
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playSiren = () => {
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
  if (audioCtx && audioCtx.state !== 'closed') {
    try { audioCtx.close(); } catch (e) {}
    audioCtx = null;
  }
};
