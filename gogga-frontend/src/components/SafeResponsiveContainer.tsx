/**
 * GOGGA - Safe Responsive Container Wrapper
 * 
 * Wraps recharts' ResponsiveContainer to prevent the 
 * "Cannot read properties of undefined (reading 'dimensions')" error
 * that occurs during SSR or before the parent container has dimensions.
 */
'use client'

import { useEffect, useState, useRef, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'

interface SafeResponsiveContainerProps {
  width?: string | number
  height?: string | number
  minWidth?: number
  minHeight?: number
  children: ReactNode
  className?: string
}

export function SafeResponsiveContainer({
  width = '100%',
  height = '100%',
  minWidth = 0,
  minHeight = 0,
  children,
  className,
}: SafeResponsiveContainerProps) {
  const [isReady, setIsReady] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    const checkDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height })
          setIsReady(true)
        }
      }
    }

    // Initial check after a small delay to ensure DOM is painted
    const timeoutId = setTimeout(checkDimensions, 50)

    // Also check on resize
    const resizeObserver = new ResizeObserver(checkDimensions)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        minWidth: minWidth > 0 ? `${minWidth}px` : undefined,
        minHeight: minHeight > 0 ? `${minHeight}px` : undefined,
      }}
    >
      {isReady && dimensions.width > 0 && dimensions.height > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : (
        <div 
          className="flex items-center justify-center text-gray-400 text-sm"
          style={{ width: '100%', height: '100%' }}
        >
          Loading chart...
        </div>
      )}
    </div>
  )
}

export default SafeResponsiveContainer
