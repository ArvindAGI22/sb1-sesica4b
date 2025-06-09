'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
  audioLevels?: number[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
}

export default function Avatar({ 
  status, 
  audioLevels = [],
  size = 'lg',
  onClick,
  className
}: AvatarProps) {
  const [morphPoints, setMorphPoints] = useState<string>('');
  const [rotation, setRotation] = useState(0);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24', 
    lg: 'w-48 h-48',
    xl: 'w-64 h-64'
  };

  const baseRadius = size === 'sm' ? 30 : size === 'md' ? 45 : size === 'lg' ? 120 : 160;
  const viewBox = size === 'sm' ? '0 0 60 60' : size === 'md' ? '0 0 90 90' : size === 'lg' ? '0 0 300 300' : '0 0 400 400';
  const center = size === 'sm' ? 30 : size === 'md' ? 45 : size === 'lg' ? 150 : 200;

  // Generate dynamic morphing points
  useEffect(() => {
    const generateMorphPoints = () => {
      const points = [];
      const numPoints = 32;
      
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        
        let radiusVariation = 0;
        
        if (status === 'listening' && audioLevels.length > 0) {
          const levelIndex = Math.floor((i / numPoints) * audioLevels.length);
          const level = audioLevels[levelIndex] || 0;
          radiusVariation = (level * 0.3) + Math.sin(Date.now() * 0.005 + i * 0.5) * (baseRadius * 0.125);
        } else if (status === 'speaking') {
          radiusVariation = Math.sin(Date.now() * 0.008 + i * 0.3) * (baseRadius * 0.2) + 
                           Math.cos(Date.now() * 0.012 + i * 0.7) * (baseRadius * 0.125);
        } else if (status === 'thinking') {
          radiusVariation = Math.sin(Date.now() * 0.003 + i * 0.2) * (baseRadius * 0.083);
        } else {
          radiusVariation = Math.sin(Date.now() * 0.002 + i * 0.1) * (baseRadius * 0.042);
        }
        
        const radius = baseRadius + radiusVariation;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;
        points.push(`${x},${y}`);
      }
      
      return points.join(' ');
    };

    const interval = setInterval(() => {
      setMorphPoints(generateMorphPoints());
      
      if (status === 'speaking' || status === 'listening') {
        setRotation(prev => (prev + 0.5) % 360);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [status, audioLevels, baseRadius, center]);

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Outer glow rings for active states */}
      {(status === 'listening' || status === 'speaking') && (
        <>
          <div className={cn(
            "absolute rounded-full bg-gradient-to-r from-emerald-500/10 to-green-500/10 animate-ping",
            size === 'sm' ? 'w-20 h-20' : size === 'md' ? 'w-32 h-32' : size === 'lg' ? 'w-80 h-80' : 'w-96 h-96'
          )}></div>
          <div className={cn(
            "absolute rounded-full bg-gradient-to-r from-emerald-400/20 to-green-400/20 animate-pulse",
            size === 'sm' ? 'w-16 h-16' : size === 'md' ? 'w-28 h-28' : size === 'lg' ? 'w-64 h-64' : 'w-80 h-80'
          )}></div>
        </>
      )}

      {/* Main avatar container */}
      <div 
        className={cn(
          sizeClasses[size],
          "cursor-pointer transition-transform hover:scale-105",
          onClick && "cursor-pointer"
        )}
        onClick={onClick}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={viewBox}
        >
          <defs>
            {/* Green gradient */}
            <radialGradient id={`greenGradient-${size}`} cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
              <stop offset="30%" stopColor="#059669" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#047857" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#064e3b" stopOpacity="0.6" />
            </radialGradient>
            
            <linearGradient id={`conicGreen-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="25%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="75%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            
            <filter id={`greenGlow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={size === 'sm' ? "2" : size === 'md' ? "4" : "8"} result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={baseRadius}
            fill={`url(#greenGradient-${size})`}
            filter={`url(#greenGlow-${size})`}
            opacity="0.3"
          />
          
          {/* Morphing shape */}
          <polygon
            points={morphPoints || `${center},${center-baseRadius} ${center+baseRadius},${center} ${center},${center+baseRadius} ${center-baseRadius},${center}`}
            fill={`url(#conicGreen-${size})`}
            filter={`url(#greenGlow-${size})`}
            className="transition-all duration-100"
            opacity="0.8"
          />
          
          {/* Center core */}
          <circle
            cx={center}
            cy={center}
            r={status === 'speaking' ? baseRadius * 0.167 : status === 'listening' ? baseRadius * 0.125 : baseRadius * 0.083}
            fill="#6ee7b7"
            className="transition-all duration-300"
            opacity="0.9"
          />
          
          {/* State-specific animations */}
          {status === 'listening' && (
            <circle
              cx={center}
              cy={center}
              r={baseRadius * 0.667}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              opacity="0.6"
              className="animate-ping"
            />
          )}
          
          {status === 'thinking' && (
            <>
              <circle
                cx={center}
                cy={center}
                r={baseRadius * 0.5}
                fill="none"
                stroke="#34d399"
                strokeWidth="1"
                opacity="0.4"
                className="animate-spin"
                strokeDasharray="10 5"
              />
              <circle
                cx={center}
                cy={center}
                r={baseRadius * 0.75}
                fill="none"
                stroke="#059669"
                strokeWidth="1"
                opacity="0.3"
                className="animate-spin"
                style={{ animationDirection: 'reverse', animationDuration: '3s' }}
                strokeDasharray="15 10"
              />
            </>
          )}
        </svg>

        {/* Audio visualization for listening */}
        {status === 'listening' && audioLevels.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-end gap-1">
              {audioLevels.slice(0, size === 'sm' ? 6 : size === 'md' ? 8 : 12).map((level, index) => (
                <div
                  key={index}
                  className="bg-emerald-300 rounded-full transition-all duration-75"
                  style={{
                    width: size === 'sm' ? '1px' : '2px',
                    height: `${Math.max(2, level * (size === 'sm' ? 0.2 : 0.4))}px`,
                    animationDelay: `${index * 30}ms`,
                    opacity: 0.8
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Speaking animation */}
        {status === 'speaking' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-emerald-300"
                  style={{
                    width: size === 'sm' ? '1px' : '2px',
                    height: size === 'sm' ? '1px' : '2px',
                    animation: `orbit 1.5s linear infinite`,
                    animationDelay: `${i * 0.375}s`,
                    transformOrigin: `0 ${size === 'sm' ? '15px' : size === 'md' ? '20px' : '30px'}`
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes orbit {
          from {
            transform: rotate(0deg) translateX(${size === 'sm' ? '15px' : size === 'md' ? '20px' : '30px'}) rotate(0deg);
          }
          to {
            transform: rotate(360deg) translateX(${size === 'sm' ? '15px' : size === 'md' ? '20px' : '30px'}) rotate(-360deg);
          }
        }
      `}</style>
    </div>
  );
}