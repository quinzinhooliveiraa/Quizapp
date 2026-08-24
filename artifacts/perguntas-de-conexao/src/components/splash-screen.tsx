import { useEffect, useState } from 'react';
import splashGlow from '@assets/logo-glow.png';
import splashSharp from '@assets/logo-nitida.png';

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [focused, setFocused] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => setFocused(true), 250);
    const fadeTimer = window.setTimeout(() => setFading(true), 1300);
    const removeTimer = window.setTimeout(() => setVisible(false), 1700);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`app-splash${fading ? ' app-splash-fade' : ''}`} aria-hidden="true">
      <div className="app-splash-stage">
        <img src={splashGlow} alt="" className="app-splash-glow" />
        <img
          src={splashSharp}
          alt=""
          className={`app-splash-sharp${focused ? ' app-splash-sharp-focused' : ''}`}
        />
      </div>
    </div>
  );
}