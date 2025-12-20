/**
 * MaskEditor Component
 * 
 * Canvas-based mask drawing tool for image editing.
 * Supports manual brush drawing and auto-selection (future).
 */

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Brush, Eraser, RotateCcw, ZoomIn, ZoomOut, Move, Circle } from 'lucide-react';

interface MaskEditorProps {
  /** Source image as base64 or URL */
  sourceImage: string;
  /** Initial mask (base64) if editing existing */
  initialMask?: string;
  /** Callback when mask changes */
  onMaskChange: (maskBase64: string) => void;
  /** Width of editor */
  width?: number;
  /** Height of editor */
  height?: number;
}

type Tool = 'brush' | 'eraser' | 'pan';

export function MaskEditor({
  sourceImage,
  initialMask,
  onMaskChange,
  width = 512,
  height = 512,
}: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  
  // Load source image
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const img = new Image();
    img.onload = () => {
      // Set canvas size to match image aspect ratio
      const aspectRatio = img.width / img.height;
      let canvasWidth = width;
      let canvasHeight = width / aspectRatio;
      
      if (canvasHeight > height) {
        canvasHeight = height;
        canvasWidth = height * aspectRatio;
      }
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Also set mask canvas size
      if (maskCanvasRef.current) {
        maskCanvasRef.current.width = canvasWidth;
        maskCanvasRef.current.height = canvasHeight;
      }
      
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    };
    
    // Handle base64 or URL
    img.src = sourceImage.startsWith('data:') ? sourceImage : `data:image/png;base64,${sourceImage}`;
  }, [sourceImage, width, height]);
  
  // Load initial mask
  useEffect(() => {
    if (!initialMask || !maskCanvasRef.current) return;
    
    const maskCtx = maskCanvasRef.current.getContext('2d');
    if (!maskCtx) return;
    
    const img = new Image();
    img.onload = () => {
      maskCtx.drawImage(img, 0, 0);
    };
    img.src = initialMask.startsWith('data:') ? initialMask : `data:image/png;base64,${initialMask}`;
  }, [initialMask]);
  
  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX: number, clientY: number;
    if ('touches' in e && e.touches && e.touches.length > 0) {
      // Cast to TouchEvent when we know it's a touch event
      const touchEvent = e as React.TouchEvent;
      clientX = touchEvent.touches[0]!.clientX;
      clientY = touchEvent.touches[0]!.clientY;
    } else {
      // Cast to MouseEvent when it's not a touch event
      const mouseEvent = e as React.MouseEvent;
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);
  
  const draw = useCallback((x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current;
    const ctx = maskCanvas?.getContext('2d');
    if (!ctx || !maskCanvas) return;
    
    ctx.beginPath();
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'white';
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    }
    
    if (lastPoint) {
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    setLastPoint({ x, y });
  }, [tool, brushSize, lastPoint]);
  
  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'pan') return;
    
    const point = getCanvasPoint(e);
    if (point) {
      setIsDrawing(true);
      setLastPoint(point);
      draw(point.x, point.y);
    }
  }, [tool, getCanvasPoint, draw]);
  
  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || tool === 'pan') return;
    
    const point = getCanvasPoint(e);
    if (point) {
      draw(point.x, point.y);
    }
  }, [isDrawing, tool, getCanvasPoint, draw]);
  
  const handlePointerUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setLastPoint(null);
      
      // Export mask
      if (maskCanvasRef.current) {
        const maskData = maskCanvasRef.current.toDataURL('image/png');
        const parts = maskData.split(',');
        if (parts.length > 1 && parts[1]) {
          onMaskChange(parts[1]);
        }
      }
    }
  }, [isDrawing, onMaskChange]);
  
  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    const ctx = maskCanvas?.getContext('2d');
    if (!ctx || !maskCanvas) return;
    
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    onMaskChange('');
  }, [onMaskChange]);
  
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
        {/* Tools */}
        <div className="flex items-center gap-1 border-r border-neutral-200 dark:border-neutral-700 pr-2 mr-2">
          <button
            onClick={() => setTool('brush')}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'brush' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            title="Brush (paint mask)"
          >
            <Brush className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded-lg transition-colors ${
              tool === 'eraser' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            title="Eraser (remove mask)"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>
        
        {/* Brush size */}
        <div className="flex items-center gap-2 flex-1">
          <Circle className="w-4 h-4 text-neutral-500" />
          <input
            id="mask-brush-size"
            name="mask-brush-size"
            type="range"
            min={5}
            max={100}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="flex-1 h-1"
          />
          <span className="text-xs text-neutral-500 w-8">{brushSize}px</span>
        </div>
        
        {/* Actions */}
        <button
          onClick={clearMask}
          className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          title="Clear mask"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
      
      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative bg-neutral-200 dark:bg-neutral-800 rounded-lg overflow-hidden"
        style={{ width, height }}
      >
        {/* Source image canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain"
        />
        
        {/* Mask canvas (overlay) */}
        <canvas
          ref={maskCanvasRef}
          className="absolute inset-0 w-full h-full object-contain opacity-50"
          style={{
            cursor: tool === 'pan' ? 'grab' : `url("data:image/svg+xml,%3Csvg width='${brushSize}' height='${brushSize}' viewBox='0 0 ${brushSize} ${brushSize}' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='${brushSize/2}' cy='${brushSize/2}' r='${brushSize/2-1}' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E") ${brushSize/2} ${brushSize/2}, crosshair`,
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
      </div>
      
      {/* Instructions */}
      <p className="text-xs text-neutral-500 text-center">
        Paint over the areas you want to edit. White areas will be modified.
      </p>
    </div>
  );
}

export default MaskEditor;
