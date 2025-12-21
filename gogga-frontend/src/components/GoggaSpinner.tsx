'use client';

import React, { useEffect, useRef } from 'react';

interface GoggaSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  overlay?: boolean; // Pin to center of screen with 3D effect
}

/**
 * Gogga Transparent 3D Spinner
 * Morphing logo with particle flow animation
 * When overlay=true, creates a floating 3D effect above all content
 */
export const GoggaSpinner: React.FC<GoggaSpinnerProps> = ({
  size = 'md',
  className = '',
  overlay = false,
}) => {
  const particlesRef = useRef<HTMLDivElement>(null);

  // Size configurations - larger for overlay mode
  const sizeConfig = {
    sm: { container: 60, logo: 22, particle: 6, flowArea: 50 },
    md: { container: overlay ? 160 : 120, logo: overlay ? 56 : 44, particle: overlay ? 14 : 12, flowArea: overlay ? 130 : 100 },
    lg: { container: 200, logo: 80, particle: 20, flowArea: 170 },
  };

  const config = sizeConfig[size];

  useEffect(() => {
    // Apply random shiny monochrome gradients to particles
    if (particlesRef.current) {
      const particles = particlesRef.current.querySelectorAll('.particle');
      particles.forEach((p) => {
        const v1 = Math.floor(Math.random() * 40); // dark black
        const v2 = Math.floor(Math.random() * 120); // mid grey
        const v3 = Math.floor(Math.random() * 220); // chrome highlight

        (p as HTMLElement).style.background = `
          radial-gradient(circle at 30% 30%,
            rgb(${v3},${v3},${v3}) 0%,
            rgb(${v2},${v2},${v2}) 40%,
            rgb(${v1},${v1},${v1}) 100%)
        `;
      });
    }
  }, []);

  // Wrapper for overlay mode
  const content = (
    <div
      className={`gogga-spinner-container ${className}`}
      style={{
        width: `${config.container}px`,
        height: `${config.container}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* Morphing logo */}
      <svg
        className="brand-morph-icon"
        style={{ width: `${config.logo}px`, height: `${config.logo}px`, color: '#000' }}
        viewBox="0 0 50 50"
      >
        <path
          className="shape-a"
          fill="currentColor"
          d="M20,20 C20,10 30,10 30,20 C30,30 20,30 20,20 Z"
          style={{
            animation: 'morph-a 4s infinite ease-in-out',
          }}
        />
        <path
          className="shape-b"
          fill="currentColor"
          d="M20,20 C10,20 10,30 20,30 C30,30 30,20 20,20 Z"
          style={{
            animation: 'morph-b 4s infinite ease-in-out',
            opacity: 0,
          }}
        />
      </svg>

      {/* Particle flow */}
      <div
        ref={particlesRef}
        className="particle-flow"
        style={{
          width: `${config.flowArea}px`,
          height: `${config.flowArea}px`,
          marginTop: '8px',
          position: 'relative',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        {/* 12 particles with staggered delays */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              width: `${config.particle}px`,
              height: `${config.particle}px`,
              borderRadius: '50%',
              position: 'absolute',
              opacity: 0,
              filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.35))',
              animation: 'flow 8s infinite ease-in-out',
              animationDelay: `${-(i * 0.7)}s`,
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>
    </div>
  );

  // Return with or without overlay wrapper
  if (overlay) {
    return (
      <div
        className="gogga-spinner-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          zIndex: 99999,
          background: 'transparent',
          pointerEvents: 'none',
        }}
      >
        {/* 3D floating transparent container - no background circle */}
        <div
          className="gogga-3d-container"
          style={{
            background: 'transparent',
            padding: '24px',
            animation: 'float3d 3s ease-in-out infinite',
            transform: 'perspective(1000px) rotateX(5deg)',
            filter: 'drop-shadow(0 8px 20px rgba(0, 0, 0, 0.15))',
          }}
        >
          {content}
        </div>
        <style jsx>{`
        @keyframes float3d {
          0%, 100% {
            transform: perspective(1000px) rotateX(5deg) translateY(0px);
          }
          50% {
            transform: perspective(1000px) rotateX(-5deg) translateY(-10px);
          }
        }
        
        @keyframes morph-a {
          0%,
          100% {
            d: path('M20,20 C20,10 30,10 30,20 C30,30 20,30 20,20 Z');
            transform: rotate(0deg);
          }
          50% {
            d: path('M20,20 C10,20 10,30 20,30 C30,30 30,20 20,20 Z');
            transform: rotate(30deg);
          }
        }

        @keyframes morph-b {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.6);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }

        @keyframes flow {
          0% {
            transform: translate(45px, 45px) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          28% {
            transform: translate(15px, 12px) scale(1.25);
          }
          46% {
            transform: translate(8px, 52px) scale(0.85);
          }
          62% {
            transform: translate(55px, 10px) scale(1.1);
          }
          78% {
            transform: translate(82px, 60px) scale(1.35);
            opacity: 0.9;
          }
          100% {
            transform: translate(45px, 85px) scale(0.45);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .particle,
          .brand-morph-icon,
          .gogga-3d-container {
            animation: none !important;
          }
        }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {content}
      <style jsx>{`
        @keyframes morph-a {
          0%,
          100% {
            d: path('M20,20 C20,10 30,10 30,20 C30,30 20,30 20,20 Z');
            transform: rotate(0deg);
          }
          50% {
            d: path('M20,20 C10,20 10,30 20,30 C30,30 30,20 20,20 Z');
            transform: rotate(30deg);
          }
        }

        @keyframes morph-b {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.6);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }

        @keyframes flow {
          0% {
            transform: translate(45px, 45px) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          28% {
            transform: translate(15px, 12px) scale(1.25);
          }
          46% {
            transform: translate(8px, 52px) scale(0.85);
          }
          62% {
            transform: translate(55px, 10px) scale(1.1);
          }
          78% {
            transform: translate(82px, 60px) scale(1.35);
            opacity: 0.9;
          }
          100% {
            transform: translate(45px, 85px) scale(0.45);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .particle,
          .brand-morph-icon {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default GoggaSpinner;
