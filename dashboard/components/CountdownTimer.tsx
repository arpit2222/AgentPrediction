'use client';

import { useEffect, useState } from 'react';

interface Props {
  deadlineSeconds: number;
  className?: string;
}

export default function CountdownTimer({ deadlineSeconds, className = '' }: Props) {
  const [remaining, setRemaining] = useState(() => deadlineSeconds - Math.floor(Date.now() / 1000));

  useEffect(() => {
    const tick = () => setRemaining(deadlineSeconds - Math.floor(Date.now() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineSeconds]);

  if (remaining <= 0) return <span className={`text-gray-500 ${className}`}>Expired</span>;

  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  const isUrgent = remaining < 3600;

  if (d > 0) {
    return (
      <span className={`${isUrgent ? 'text-red-400' : 'text-gray-300'} ${className}`}>
        {d}d {h}h
      </span>
    );
  }
  if (h > 0) {
    return (
      <span className={`text-yellow-400 ${className}`}>
        {h}h {m}m
      </span>
    );
  }
  return (
    <span className={`animate-pulse text-red-400 ${className}`}>
      {m}m {String(s).padStart(2, '0')}s
    </span>
  );
}
