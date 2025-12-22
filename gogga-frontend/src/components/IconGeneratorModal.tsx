'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, Sparkles, Palette, Box, Lightbulb, Layers, Download, FileImage, FileCode, Wand2, Copy, LayoutGrid } from 'lucide-react';
import { getDatabase, generateId } from '@/lib/db';
import type { IconGenerationDoc } from '@/lib/rxdb/schemas';

interface IconGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  tier: 'JIVE' | 'JIGGA';
}

interface IconQuota {
  used: number;
  limit: number;
  remaining: number;
}

const PRESETS = [
  {
    title: "Golden Bok",
    icon: "🦌",
    color: "bg-(--primary-100) border-(--primary-300) hover:border-(--primary-500)",
    prompt: "A metallic gold Springbok head with geometric facets, stylized for a modern app icon. Elegant, proud, minimal."
  },
  {
    title: "Beaded Love",
    icon: "❤️",
    color: "bg-(--primary-50) border-(--primary-200) hover:border-(--primary-400)",
    prompt: "A 3D heart shape made entirely of intricate Zulu beadwork patterns. Red, white, and black beads. Glossy texture."
  },
  {
    title: "Neon Taxi",
    icon: "🚐",
    color: "bg-(--primary-100) border-(--primary-300) hover:border-(--primary-500)",
    prompt: "A futuristic cyberpunk South African taxi minibus. Neon purple and pink lights, dark background, glossy finish."
  },
  {
    title: "Shweshwe",
    icon: "💠",
    color: "bg-(--primary-50) border-(--primary-200) hover:border-(--primary-400)",
    prompt: "A circular shield pattern featuring traditional Indigo Shweshwe fabric texture. 3D embossed look, high detail."
  },
  {
    title: "Potjie Pot",
    icon: "🥘",
    color: "bg-(--primary-100) border-(--primary-300) hover:border-(--primary-500)",
    prompt: "A cute, rounded cast iron Potjie pot with steam coming out. Matte black texture with fire glow reflection."
  },
  {
    title: "Protea",
    icon: "🌸",
    color: "bg-(--primary-50) border-(--primary-200) hover:border-(--primary-400)",
    prompt: "A magnificent King Protea flower rendered in soft 3D claymorphism style. Pastel pinks and purples. Soft lighting."
  }
];

export default function IconGeneratorModal({ isOpen, onClose, userId, tier }: IconGeneratorModalProps) {
  const [customPrompt, setCustomPrompt] = useState(
    "A 3D Ubuntu symbol (circles connected) rendered in glossy beadwork texture. Use bright South African colors. Friendly and modern."
  );
  const [complexity, setComplexity] = useState('balanced');
  const [lighting, setLighting] = useState('studio');
  const [backing, setBacking] = useState('none');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIcon, setCurrentIcon] = useState<IconGenerationDoc | null>(null);
  const [history, setHistory] = useState<IconGenerationDoc[]>([]);
  const [quota, setQuota] = useState<IconQuota | null>(null);

  // Load quota and history on mount
  useEffect(() => {
    if (isOpen && userId) {
      loadQuota();
      loadHistory();
    }
  }, [isOpen, userId]);

  const loadQuota = async () => {
    try {
      const response = await fetch(`/api/v1/icons/quota?user_id=${userId}&tier=${tier}`);
      if (response.ok) {
        const data = await response.json();
        setQuota(data);
      }
    } catch (err) {
      console.error('Failed to load quota:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const db = await getDatabase();
      const icons = await db.iconGenerations
        .find({
          selector: { userId },
          sort: [{ createdAt: 'desc' }]
        })
        .exec();
      setHistory(icons.map(doc => doc.toJSON()));
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!userId || !customPrompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Call backend API
      const response = await fetch('/api/v1/icons/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          tier,
          prompt: customPrompt,
          lighting,
          complexity,
          backing: backing === 'none' ? 'None (Transparent)' : backing
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate icon');
      }

      const result = await response.json();

      // Save to RxDB - map backend response to our schema
      // Backend returns: { svg, usage: { promptTokens, candidatesTokens, totalTokens }, cost: { zar, usd }, quota }
      const db = await getDatabase();
      const iconDoc: IconGenerationDoc = {
        id: generateId(),
        userId,
        svgContent: result.svg,
        prompt: customPrompt,
        tier,
        tokensPrompt: result.usage?.promptTokens ?? 0,
        tokensCandidates: result.usage?.candidatesTokens ?? 0,
        tokensTotal: result.usage?.totalTokens ?? 0,
        costZar: result.cost?.zar ?? 0,
        lighting,
        complexity,
        backing: backing === 'none' ? 'None (Transparent)' : backing,
        createdAt: new Date().toISOString(),
        downloaded: false
      };

      await db.iconGenerations.insert(iconDoc);
      setCurrentIcon(iconDoc);
      setHistory(prev => [iconDoc, ...prev]);
      await loadQuota(); // Refresh quota

    } catch (err: any) {
      setError(err.message || 'Something went wrong generating the icon');
    } finally {
      setIsLoading(false);
    }
  }, [userId, tier, customPrompt, lighting, complexity, backing]);

  const handleDownloadSVG = (icon: IconGenerationDoc) => {
    const blob = new Blob([icon.svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gogga-icon-${icon.id}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markDownloaded(icon.id);
  };

  const handleDownloadPNG = async (icon: IconGenerationDoc) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgBlob = new Blob([icon.svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 512, 512);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `gogga-icon-${icon.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      markDownloaded(icon.id);
    };
    img.src = url;
  };

  const markDownloaded = async (iconId: string) => {
    try {
      const db = await getDatabase();
      const doc = await db.iconGenerations.findOne(iconId).exec();
      if (doc) {
        await doc.update({ $set: { downloaded: true } });
      }
    } catch (err) {
      console.error('Failed to mark as downloaded:', err);
    }
  };

  const handleCopy = (icon: IconGenerationDoc) => {
    navigator.clipboard.writeText(icon.svgContent);
  };

  const restoreFromHistory = (icon: IconGenerationDoc) => {
    setCurrentIcon(icon);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-(--primary-50) rounded-3xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-(--primary-900) text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette size={24} />
            <div>
              <h2 className="text-xl font-bold">GOGGA Icon Studio</h2>
              <p className="text-xs opacity-75">'n Whatsapp image for "Jou Ma" 🇿🇦</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {quota && (
              <div className="text-sm font-bold bg-white/20 px-4 py-2 rounded-full">
                {quota.remaining}/{quota.limit} icons remaining
              </div>
            )}
            <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-6 bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            {error}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            {/* Control Panel */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="bg-white rounded-2xl p-6 shadow-lg flex-1 overflow-y-auto">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Sparkles size={20} className="text-(--primary-600)" />
                  Design Controls
                </h3>

                {/* Presets */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-(--primary-700) uppercase mb-3 block">
                    Quick Inspiration
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustomPrompt(preset.prompt)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${preset.color}`}
                      >
                        <span className="text-2xl mb-1">{preset.icon}</span>
                        <span className="text-[10px] font-bold text-(--primary-900)">{preset.title}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt */}
                <div className="mb-6">
                  <label className="block text-sm font-bold text-(--primary-900) mb-2">Your Vision</label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full h-32 p-4 rounded-xl border-2 border-(--primary-200) focus:border-(--primary-500) focus:ring-4 focus:ring-(--primary-500)/10 outline-none resize-none font-['Quicksand']"
                    placeholder="Describe your icon..."
                  />
                </div>

                {/* Controls */}
                <div className="bg-(--primary-50) rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-(--primary-700) uppercase flex items-center gap-1 mb-2">
                        <Box size={10} /> Complexity
                      </label>
                      <select
                        value={complexity}
                        onChange={(e) => setComplexity(e.target.value)}
                        className="w-full text-sm font-semibold bg-white border-2 border-(--primary-200) text-(--primary-900) rounded-lg p-2 focus:ring-2 focus:ring-(--primary-500) outline-none"
                      >
                        <option value="minimalist">Minimalist</option>
                        <option value="balanced">Balanced</option>
                        <option value="intricate">Intricate</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-(--primary-700) uppercase flex items-center gap-1 mb-2">
                        <Lightbulb size={10} /> Lighting
                      </label>
                      <select
                        value={lighting}
                        onChange={(e) => setLighting(e.target.value)}
                        className="w-full text-sm font-semibold bg-white border-2 border-(--primary-200) text-(--primary-900) rounded-lg p-2 focus:ring-2 focus:ring-(--primary-500) outline-none"
                      >
                        <option value="studio">Studio</option>
                        <option value="soft">Soft</option>
                        <option value="dramatic">Dramatic</option>
                        <option value="neon">Neon</option>
                        <option value="golden_hour">Golden Hour</option>
                        <option value="rembrandt">Rembrandt</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-(--primary-700) uppercase flex items-center gap-1 mb-2">
                      <Layers size={10} /> Backing
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {['none', 'circle', 'square', 'shield'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setBacking(opt)}
                          className={`text-xs font-semibold py-2 rounded-lg border transition-all ${
                            backing === opt
                              ? 'bg-(--primary-900) text-white border-(--primary-900) shadow-md scale-105'
                              : 'bg-white text-(--primary-700) border-(--primary-200) hover:border-(--primary-300)'
                          }`}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !quota || quota.remaining === 0}
                  className={`w-full mt-6 py-4 rounded-xl font-bold text-lg text-white shadow-xl transition-all ${
                    isLoading || !quota || quota.remaining === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:scale-[1.02] hover:shadow-2xl'
                  }`}
                >
                  {isLoading ? 'Generating...' : quota?.remaining === 0 ? 'Quota Exceeded' : 'Generate Icon'}
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="lg:col-span-7">
              {isLoading ? (
                <div className="w-full aspect-square bg-white rounded-3xl flex items-center justify-center border-4 border-dashed border-(--primary-200)">
                  <div className="text-center">
                    <Sparkles className="w-16 h-16 text-(--primary-600) animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-(--primary-900)">Generating...</h3>
                    <p className="text-(--primary-600)">Creating your masterpiece</p>
                  </div>
                </div>
              ) : currentIcon ? (
                <div className="space-y-4">
                  <div className="relative w-full aspect-square bg-white rounded-3xl border-2 border-(--primary-200) shadow-xl flex items-center justify-center overflow-hidden group">
                    <div
                      className="w-[85%] h-[85%] transition-transform duration-500 group-hover:scale-110"
                      dangerouslySetInnerHTML={{ __html: currentIcon.svgContent }}
                    />
                    <button
                      onClick={() => handleCopy(currentIcon)}
                      className="absolute top-4 right-4 bg-white/90 text-(--primary-700) hover:text-(--primary-900) p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Copy size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    <button
                      onClick={() => handleDownloadPNG(currentIcon)}
                      className="col-span-8 flex items-center justify-center gap-3 bg-(--primary-900) hover:bg-(--primary-800) text-white py-4 px-6 rounded-xl font-bold transition-all shadow-lg"
                    >
                      <FileImage size={24} />
                      <div className="text-left">
                        <div>Download Sticker</div>
                        <div className="text-xs opacity-75">PNG • 512x512 • WhatsApp Ready</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadSVG(currentIcon)}
                      className="col-span-4 flex flex-col items-center justify-center bg-(--primary-800) hover:bg-(--primary-700) text-white py-2 px-4 rounded-xl font-semibold transition-all"
                    >
                      <FileCode size={20} className="mb-1" />
                      <span className="text-xs">Save SVG</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-square bg-white rounded-3xl flex flex-col items-center justify-center border-2 border-dashed border-(--primary-200)">
                  <Wand2 size={48} className="text-(--primary-300) mb-4" />
                  <h3 className="text-xl font-bold text-(--primary-900) mb-2">Ready to Create</h3>
                  <p className="text-(--primary-600) text-sm max-w-xs text-center">
                    Select a preset or describe your vision to get started
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="mt-8 pt-8 border-t border-(--primary-200)">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <LayoutGrid size={24} className="text-(--primary-600)" />
                  <div>
                    <h3 className="text-xl font-bold text-(--primary-900)">Your Gallery</h3>
                    <p className="text-sm text-(--primary-600)">Previously generated icons</p>
                  </div>
                </div>
                <span className="text-xs font-medium bg-(--primary-200) px-3 py-1 rounded-full text-(--primary-700)">
                  {history.length} items
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => restoreFromHistory(item)}
                    className="group relative aspect-square bg-white rounded-xl border-2 border-(--primary-200) hover:border-(--primary-500) hover:ring-4 hover:ring-(--primary-500)/10 hover:shadow-xl transition-all overflow-hidden p-4"
                  >
                    <div
                      className="w-full h-full flex items-center justify-center transition-transform group-hover:scale-110"
                      dangerouslySetInnerHTML={{ __html: item.svgContent }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-(--primary-900)/90 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                      <p className="text-white text-xs font-medium line-clamp-2">
                        {item.prompt.split('\n')[0]}
                      </p>
                      <span className="text-[10px] text-(--primary-300) mt-1 block">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
