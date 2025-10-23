import { useRef, useState, useEffect } from 'react';

const useResetTimer = (delay: number) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timerCompleted, setTimerCompleted] = useState(false);

  const startTimer = () => {
    setTimerCompleted(false);
    timerRef.current = setTimeout(() => {
      setTimerCompleted(true);
    }, delay);
  };

  const resetTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setTimerCompleted(false);
    timerRef.current = setTimeout(() => {
      setTimerCompleted(true);
    }, delay);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTimerCompleted(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    startTimer,
    resetTimer,
    stopTimer,
    timerCompleted,
  };
};

export default useResetTimer;
