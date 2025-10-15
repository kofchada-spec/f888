import { useEffect, useState } from 'react';
import { haptics } from '@/utils/haptics';
import confetti from 'canvas-confetti';

interface CelebrationProps {
  trigger: boolean;
  message?: string;
  duration?: number;
}

export const Celebration = ({ trigger, message = "Bravo ! 🎉", duration = 3000 }: CelebrationProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger) {
      setShow(true);
      
      // Haptic celebration
      haptics.celebrate();

      // Confetti
      const count = 200;
      const defaults = {
        origin: { y: 0.7 },
        zIndex: 9999
      };

      function fire(particleRatio: number, opts: confetti.Options) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      }

      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      });

      fire(0.2, {
        spread: 60,
      });

      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
      });

      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
      });

      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      });

      // Hide after duration
      setTimeout(() => {
        setShow(false);
      }, duration);
    }
  }, [trigger, duration]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none">
      <div className="bg-gradient-to-br from-primary to-secondary text-white px-8 py-6 rounded-3xl shadow-2xl animate-scale-in">
        <p className="text-2xl font-bold text-center">{message}</p>
      </div>
    </div>
  );
};
