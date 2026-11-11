import React from 'react';

export const WaveDivider = ({
  fill = 'var(--bg-secondary)',
  bgColor = 'transparent',
  flip = false,
  variant = 1,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`wave-divider ${flip ? 'flip' : ''} ${className}`}
      style={{ backgroundColor: bgColor, ...style }}
      aria-hidden="true"
    >
      {variant === 1 && (
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Subtle accent under-layer wave for visual depth */}
          <path
            d="M0,24L48,34.7C96,45,192,67,288,69.3C384,72,480,56,576,45.3C672,35,768,29,864,37.3C960,45,1056,67,1152,72C1248,77,1344,67,1392,61.3L1440,56L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            fill={fill}
            opacity="0.3"
          />
          {/* Main solid foreground wave */}
          <path
            d="M0,48L60,56C120,64,240,80,360,82.7C480,85,600,75,720,64C840,53,960,43,1080,48C1200,53,1320,75,1380,85.3L1440,96L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z"
            fill={fill}
          />
        </svg>
      )}

      {variant === 2 && (
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Accent secondary wave */}
          <path
            d="M0,32L80,42.7C160,53,320,75,480,74.7C640,75,800,53,960,45.3C1120,37,1280,43,1360,45.3L1440,48L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
            fill={fill}
            opacity="0.25"
          />
          {/* Primary wave */}
          <path
            d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
            fill={fill}
          />
        </svg>
      )}

      {variant === 3 && (
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Accent layer */}
          <path
            d="M0,20 C360,90 520,10 880,70 C1200,120 1320,30 1440,60 L1440,120 L0,120 Z"
            fill={fill}
            opacity="0.25"
          />
          {/* Crest wave */}
          <path
            d="M0,45 C320,105 540,15 860,65 C1180,115 1340,35 1440,55 L1440,120 L0,120 Z"
            fill={fill}
          />
        </svg>
      )}
    </div>
  );
};
