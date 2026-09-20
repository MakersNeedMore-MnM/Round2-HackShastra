import React from 'react';

export const VideoBackground: React.FC = () => (
  <div className="video-background" aria-hidden="true">
    <video
      className="video-background-media"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      src="/assets/earth-at-night-from-space.mp4"
    />
    <div className="video-background-overlay" />
  </div>
);