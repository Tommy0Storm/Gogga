'use client'

/**
 * Activity Component - React 19.2 Pattern
 * 
 * Implements the Activity component pattern from React 19.2 for managing
 * visibility and resource usage of UI sections.
 * 
 * When mode="hidden":
 * - Content is visually hidden (CSS display:none or visibility)
 * - Effects are paused/unmounted to save resources
 * - State is preserved for instant restoration
 * 
 * Synergy: Combines with Python 3.14 free-threading for parallel processing
 * while UI sections are hidden, and Next.js 16 PPR for static shell caching.
 * 
 * @see https://react.dev/reference/react/Activity (experimental)
 */

import { 
  ReactNode, 
  useState, 
  useEffect, 
  useRef, 
  createContext, 
  useContext,
  memo 
} from 'react'

interface ActivityContextValue {
  isActive: boolean
  mode: 'visible' | 'hidden'
}

const ActivityContext = createContext<ActivityContextValue>({
  isActive: true,
  mode: 'visible',
})

/**
 * Hook to check if the current Activity context is active
 * Use this in child components to conditionally run effects
 */
export function useActivityStatus() {
  return useContext(ActivityContext)
}

interface ActivityProps {
  /**
   * Mode of the activity:
   * - 'visible': Content is shown, effects run normally
   * - 'hidden': Content is hidden, effects are paused
   */
  mode: 'visible' | 'hidden'
  
  /**
   * Children to render
   */
  children: ReactNode
  
  /**
   * Optional className for the wrapper
   */
  className?: string
  
  /**
   * Whether to unmount children when hidden (default: false)
   * If false, children are hidden via CSS but remain mounted
   * If true, children are unmounted when hidden (saves more resources)
   */
  unmountOnHide?: boolean
  
  /**
   * Callback when activity becomes visible
   */
  onShow?: () => void
  
  /**
   * Callback when activity becomes hidden
   */
  onHide?: () => void
}

/**
 * Activity Component
 * 
 * Manages visibility and resource usage of UI sections.
 * When hidden, effects are paused and updates are deferred.
 * 
 * @example
 * ```tsx
 * <Activity mode={isRAGPanelVisible ? 'visible' : 'hidden'}>
 *   <RAGDocumentPanel />
 * </Activity>
 * ```
 */
export const Activity = memo(function Activity({
  mode,
  children,
  className = '',
  unmountOnHide = false,
  onShow,
  onHide,
}: ActivityProps) {
  const isActive = mode === 'visible'
  const prevModeRef = useRef(mode)
  const [hasBeenVisible, setHasBeenVisible] = useState(isActive)
  
  // Track when content has been visible at least once
  useEffect(() => {
    if (isActive && !hasBeenVisible) {
      setHasBeenVisible(true)
    }
  }, [isActive, hasBeenVisible])
  
  // Call callbacks on mode change
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      if (mode === 'visible') {
        onShow?.()
      } else {
        onHide?.()
      }
      prevModeRef.current = mode
    }
  }, [mode, onShow, onHide])
  
  const contextValue: ActivityContextValue = {
    isActive,
    mode,
  }
  
  // If unmountOnHide and hidden, don't render children at all
  if (unmountOnHide && !isActive) {
    return null
  }
  
  // If content has never been visible and currently hidden, defer initial render
  if (!hasBeenVisible && !isActive) {
    return null
  }
  
  return (
    <ActivityContext.Provider value={contextValue}>
      <div
        className={className}
        style={{
          display: isActive ? undefined : 'none',
          // Future: Use content-visibility: hidden for better performance
          // contentVisibility: isActive ? 'visible' : 'hidden',
        }}
        aria-hidden={!isActive}
      >
        {children}
      </div>
    </ActivityContext.Provider>
  )
})

/**
 * Hook to pause effects when Activity is hidden
 * 
 * Use this in components that need to pause expensive operations
 * when their parent Activity is hidden.
 * 
 * @example
 * ```tsx
 * function RAGDocumentList() {
 *   const { isActive } = useActivityStatus()
 *   
 *   // Only poll for updates when visible
 *   useActivityEffect(() => {
 *     const interval = setInterval(refreshDocs, 30000)
 *     return () => clearInterval(interval)
 *   }, [refreshDocs])
 * }
 * ```
 */
export function useActivityEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList = []
) {
  const { isActive } = useActivityStatus()
  const cleanupRef = useRef<(() => void) | void>()
  
  useEffect(() => {
    if (isActive) {
      cleanupRef.current = effect()
    }
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = undefined
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, ...deps])
}

export default Activity
