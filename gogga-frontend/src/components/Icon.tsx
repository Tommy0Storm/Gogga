'use client';

import React from 'react';
import { normalizeIcon } from '@/lib/iconMapping';

interface IconProps {
  name: string;
  className?: string;
  size?: number;
  color?: string;
  'aria-label'?: string;
}

/**
 * Icon component that renders normalized Material Icons
 */
export const Icon: React.FC<IconProps> = ({
  name,
  className = '',
  size = 24,
  color,
  'aria-label': ariaLabel,
}) => {
  const normalizedName = normalizeIcon(name);
  
  const style: React.CSSProperties = {
    fontSize: size,
    ...(color && { color }),
  };
  
  return (
    <span
      className={`material-icons ${className}`.trim()}
      style={style}
      aria-label={ariaLabel || normalizedName.replace(/_/g, ' ')}
      role="img"
    >
      {normalizedName}
    </span>
  );
};

interface TierIconProps {
  tier: 'FREE' | 'JIVE' | 'JIGGA';
  size?: number;
  className?: string;
}

/**
 * Tier-specific icon for GOGGA subscription tiers
 */
export const TierIcon: React.FC<TierIconProps> = ({ tier, size = 20, className = '' }) => {
  const tierIcons: Record<string, string> = {
    FREE: 'star_border',
    JIVE: 'star_half',
    JIGGA: 'star',
  };
  
  const tierColors: Record<string, string> = {
    FREE: '#6B7280',  // Gray
    JIVE: '#F59E0B',  // Amber
    JIGGA: '#8B5CF6', // Purple
  };
  
  return (
    <Icon
      name={tierIcons[tier] || 'star_border'}
      size={size}
      color={tierColors[tier]}
      className={className}
      aria-label={`${tier} tier`}
    />
  );
};

interface StatusIconProps {
  status: 'success' | 'error' | 'warning' | 'info' | 'loading';
  size?: number;
  className?: string;
  animate?: boolean;
}

/**
 * Status indicator icon with predefined colors
 */
export const StatusIcon: React.FC<StatusIconProps> = ({
  status,
  size = 20,
  className = '',
  animate = false,
}) => {
  const statusConfig: Record<string, { icon: string; color: string }> = {
    success: { icon: 'check_circle', color: '#10B981' },
    error: { icon: 'error', color: '#EF4444' },
    warning: { icon: 'warning', color: '#F59E0B' },
    info: { icon: 'info', color: '#3B82F6' },
    loading: { icon: 'autorenew', color: '#6B7280' },
  };
  
  const config = statusConfig[status] || statusConfig.info;
  const animationClass = status === 'loading' && animate ? 'animate-spin' : '';
  
  return (
    <Icon
      name={config.icon}
      size={size}
      color={config.color}
      className={`${className} ${animationClass}`.trim()}
      aria-label={status}
    />
  );
};

export default Icon;