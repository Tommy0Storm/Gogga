/**
 * Icon Component
 * React component for rendering normalized Material Icons
 * 
 * Uses the IconMappingService to automatically normalize icon names
 * to their canonical Google Material Icons equivalents.
 */

'use client';

import React from 'react';
import { normalizeIcon, type IconProps } from '@/lib/iconMapping';

// ============================================================================
// ICON COMPONENT
// ============================================================================

/**
 * Icon component that renders normalized Material Icons.
 * Automatically normalizes alternative icon names to canonical versions.
 * 
 * @example
 * // Renders 'local_fire_department' (normalized from 'fireplace')
 * <Icon name="fireplace" size={24} color="#333" />
 * 
 * @example
 * // Renders 'check_circle' (already canonical)
 * <Icon name="check_circle" className="text-green-500" />
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

// ============================================================================
// ICON VARIANTS
// ============================================================================

type MaterialSymbolVariant = 'outlined' | 'rounded' | 'sharp';

interface SymbolIconProps extends IconProps {
  /** Material Symbols variant */
  variant?: MaterialSymbolVariant;
  /** Fill amount (0-1) for filled style */
  fill?: 0 | 1;
  /** Weight (100-700) */
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  /** Grade (-25 to 200) */
  grade?: number;
  /** Optical size (20-48) */
  opticalSize?: 20 | 24 | 40 | 48;
}

/**
 * Material Symbols icon component with variable font support.
 * Provides more customization options than the standard Icon component.
 * 
 * @example
 * <SymbolIcon 
 *   name="favorite" 
 *   variant="rounded" 
 *   fill={1} 
 *   weight={500} 
 * />
 */
export const SymbolIcon: React.FC<SymbolIconProps> = ({
  name,
  className = '',
  size = 24,
  color,
  variant = 'outlined',
  fill = 0,
  weight = 400,
  grade = 0,
  opticalSize = 24,
  'aria-label': ariaLabel,
}) => {
  const normalizedName = normalizeIcon(name);
  
  const style: React.CSSProperties = {
    fontSize: size,
    fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
    ...(color && { color }),
  };
  
  return (
    <span
      className={`material-symbols-${variant} ${className}`.trim()}
      style={style}
      aria-label={ariaLabel || normalizedName.replace(/_/g, ' ')}
      role="img"
    >
      {normalizedName}
    </span>
  );
};

// ============================================================================
// SPECIALIZED ICON COMPONENTS
// ============================================================================

interface TierIconProps {
  /** User tier: FREE, JIVE, or JIGGA */
  tier: 'FREE' | 'JIVE' | 'JIGGA';
  size?: number;
  className?: string;
}

/**
 * Tier-specific icon for GOGGA subscription tiers.
 * 
 * @example
 * <TierIcon tier="JIGGA" size={20} />
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
  /** Status type */
  status: 'success' | 'error' | 'warning' | 'info' | 'loading';
  size?: number;
  className?: string;
  /** Animate loading icon */
  animate?: boolean;
}

/**
 * Status indicator icon with predefined colors.
 * 
 * @example
 * <StatusIcon status="success" />
 * <StatusIcon status="loading" animate />
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

interface ActionIconProps {
  /** Action type */
  action: 'add' | 'edit' | 'delete' | 'save' | 'cancel' | 'refresh' | 'search' | 'filter' | 'download' | 'upload' | 'share' | 'copy';
  size?: number;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * Common action icons with consistent styling.
 * 
 * @example
 * <ActionIcon action="edit" onClick={handleEdit} />
 */
export const ActionIcon: React.FC<ActionIconProps> = ({
  action,
  size = 20,
  className = '',
  onClick,
  disabled = false,
}) => {
  const actionIcons: Record<string, string> = {
    add: 'add',
    edit: 'edit',
    delete: 'delete',
    save: 'save',
    cancel: 'close',
    refresh: 'refresh',
    search: 'search',
    filter: 'filter_list',
    download: 'download',
    upload: 'upload',
    share: 'share',
    copy: 'content_copy',
  };
  
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };
  
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${className}`.trim()}
      aria-label={action}
    >
      <Icon
        name={actionIcons[action] || action}
        size={size}
        color={disabled ? '#9CA3AF' : '#374151'}
      />
    </button>
  );
};

// ============================================================================
// DOMAIN-SPECIFIC ICON SETS
// ============================================================================

interface DomainIconSetProps {
  /** Domain for icon suggestions */
  domain: 'cooking' | 'technology' | 'health' | 'business' | 'learning' | 'travel' | 'social' | 'media';
  /** Icon size */
  size?: number;
  /** Maximum icons to display */
  limit?: number;
  /** Callback when icon is selected */
  onSelect?: (iconName: string) => void;
  /** Currently selected icon */
  selected?: string;
  className?: string;
}

/**
 * Displays a set of icons for a specific domain.
 * Useful for icon pickers in context-aware UIs.
 * 
 * @example
 * <DomainIconSet 
 *   domain="technology" 
 *   onSelect={setSelectedIcon} 
 *   selected={currentIcon}
 * />
 */
export const DomainIconSet: React.FC<DomainIconSetProps> = ({
  domain,
  size = 24,
  limit = 10,
  onSelect,
  selected,
  className = '',
}) => {
  const { getIconsForDomain } = require('@/lib/iconMapping');
  const icons = getIconsForDomain(domain).slice(0, limit);
  
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {icons.map((icon: string) => (
        <button
          key={icon}
          type="button"
          onClick={() => onSelect?.(icon)}
          className={`p-2 rounded border transition-colors ${
            selected === icon
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-400'
          }`}
          aria-label={icon.replace(/_/g, ' ')}
          aria-pressed={selected === icon}
        >
          <Icon name={icon} size={size} />
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default Icon;
