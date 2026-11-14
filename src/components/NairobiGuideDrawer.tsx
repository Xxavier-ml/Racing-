import { useState, type ChangeEvent } from 'react';
import {
  Compass,
  ExternalLink,
  Film,
  Image as ImageIcon,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  NAIROBI_LANDMARKS,
  NAIROBI_ROUNDABOUTS,
  NAIROBI_STREETS,
  type NairobiLandmark,
} from '../game/nairobiMap';

interface NairobiGuideDrawerProps {
  open: boolean;
  activeLandmarkId: string;
  playerPos: { x: number; z: number } | null;
  onClose: () => void;
  onSelectDestination: (landmarkId: string) => void;
  onTeleportToLandmark: (landmarkId: string) => void;
}

type DrawerTab = 'map' | 'explore' | 'studio';

interface ExploreResult {
  text: string;
  mode: 'maps' | 'search';
  mapLinks: Array<{ title: string; uri: string; snippet?: string }>;
  webLinks: Array<{ title: string; uri: string }>;
}

export function NairobiGuideDrawer({
  open,
  activeLandmarkId,
  playerPos,
  onClose,
  onSelectDestination,
  onTeleportToLandmark,
}: NairobiGuideDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('map');
  const [selectedLm, setSelectedLm] = useState<NairobiLandmark>(
    () => NAIROBI_LANDMARKS.find((l) => l.id === activeLandmarkId) ?? NAIROBI_LANDMARKS[0],
  );

  // Nairobi Explorer (Search & Maps Grounding)
  const [exploreQuery, setExploreQuery] = useState('How do I get from Kenyatta Avenue to KICC and Times Tower?');
  const [exploreMode, setExploreMode] = useState<'maps' | 'search'>('maps');
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [exploreResult, setExploreResult] = useState<ExploreResult | null>(null);

  // Media Studio (Image + Video)
  const [imagePrompt, setImagePrompt] = useState(
    'Golden hour street view of Kenyatta Avenue in Nairobi with jacaranda trees, KICC tower, and vibrant matatus',
  );
  const [imageModel, setImageModel] = useState<'gemini-nano-banana-2.1' | 'gemini-3-pro-image-preview'>(
    'gemini-nano-banana-2.1',
  );
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [editSourceBase64, setEditSourceBase64] = useState<string | null>(null);
  const [editSourceMime, setEditSourceMime] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Video Animation (Omni 1.2 Flash)
  const [videoPhotoBase64, setVideoPhotoBase64] = useState<string | null>(null);
  const [videoPhotoMime, setVideoPhotoMime] = useState<string | null>(null);
  const [videoPhotoPreview, setVideoPhotoPreview] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState(
    'Smooth driving dashcam motion along Nairobi Uhuru Highway under the Expressway with sunlit traffic.',
  );
  const [videoAspect, setVideoAspect] = useState<'16:9' | '9:16'>('16:9');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  if (!open) return null;

  const handleFileRead = (
    e: ChangeEvent<HTMLInputElement>,
    onLoad: (base64: string, mime: string, dataUrl: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx > -1) {
        onLoad(dataUrl.slice(commaIdx + 1), file.type || 'image/png', dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const runExplore = async () => {
    if (!exploreQuery.trim()) {
      setExploreError('Please enter a Nairobi street or landmark question.');
      return;
    }
    setExploreLoading(true);
    setExploreError(null);
    try {
      const res = await fetch('/api/nairobi/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: exploreQuery,
          mode: exploreMode,
          lat: selectedLm.lat,
          lng: selectedLm.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch Nairobi guide.');
      }
      setExploreResult(data as ExploreResult);
    } catch (err) {
      setExploreError(err instanceof Error ? err.message : 'Unable to reach Nairobi guide.');
    } finally {
      setExploreLoading(false);
    }
  };

  const runGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      setImageError('Please enter a prompt for image generation.');
      return;
    }
    setImageLoading(true);
    setImageError(null);
    try {
      const res = await fetch('/api/nairobi/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          model: imageModel,
          imageSize,
          aspectRatio: '16:9',
          sourceImageBase64: editSourceBase64 ?? undefined,
          sourceMimeType: editSourceMime ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Image generation failed.');
      }
      setGeneratedImageUrl(data.imageUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setImageLoading(false);
    }
  };

  const runAnimateVideo = async () => {
    if (!videoPhotoBase64 || !videoPhotoMime) {
      setVideoError('Please upload a Nairobi or vehicle photo first.');
      return;
    }
    setVideoLoading(true);
    setVideoError(null);
    try {
      const res = await fetch('/api/nairobi/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          imageBase64: videoPhotoBase64,
          mimeType: videoPhotoMime,
          aspectRatio: videoAspect,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Video animation failed.');
      }
      setGeneratedVideoUrl(data.videoDataUrl);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Video animation failed.');
    } finally {
      setVideoLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nairobi City Wayfinder and AI Studio"
        className="w-full max-w-3xl h-full bg-[#0f1419] border-l border-white/15 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'Chakra Petch, sans-serif' }}
            >
              NAIROBI WAYFINDER &amp; CITY STUDIO
            </h2>
            <p className="text-xs text-slate-400">
              Explore real CBD avenues, set GPS destinations, or query live Nairobi landmarks
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Nairobi Wayfinder"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTab('map')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'map' ? 'bg-amber-500 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>CBD Street Map</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('explore')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'explore' ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Live Nairobi Guide</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('studio')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'studio' ? 'bg-sky-500 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Media Studio</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'map' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Interactive Vector Street Map */}
              <div className="md:col-span-7 bg-[#151c24] border border-white/10 rounded-xl p-3">
                <svg
                  viewBox="-235 -250 470 535"
                  className="w-full h-auto"
                  role="img"
                  aria-label="Interactive Nairobi CBD Street Map"
                >
                  <rect x="-235" y="-250" width="470" height="535" rx="14" fill="#131920" />
                  <rect x="-220" y="-160" width="108" height="290" rx="8" fill="#183629" />
                  <text x="-168" y="-12" fill="#6ee7b7" fontSize="11" textAnchor="middle" fontWeight="600">
                    UHURU PARK
                  </text>

                  {NAIROBI_STREETS.map((s) => (
                    <g key={s.id}>
                      {s.axis === 'ns' ? (
                        <>
                          <line
                            x1={s.coord}
                            y1={s.start}
                            x2={s.coord}
                            y2={s.end}
                            stroke="#334155"
                            strokeWidth={s.width * 0.72}
                            strokeLinecap="round"
                          />
                          <text
                            x={s.coord - 13}
                            y={(s.start + s.end) * 0.5 - 10}
                            fill="#94a3b8"
                            fontSize="8.5"
                            fontWeight="600"
                            textAnchor="middle"
                            transform={`rotate(-90 ${s.coord - 13} ${(s.start + s.end) * 0.5 - 10})`}
                          >
                            {s.name}
                          </text>
                        </>
                      ) : (
                        <>
                          <line
                            x1={s.start}
                            y1={s.coord}
                            x2={s.end}
                            y2={s.coord}
                            stroke="#334155"
                            strokeWidth={s.width * 0.72}
                            strokeLinecap="round"
                          />
                          <text
                            x={s.id === 'mombasa-langata' ? 35 : -10}
                            y={s.coord - 11}
                            fill="#94a3b8"
                            fontSize="8.5"
                            fontWeight="600"
                            textAnchor="middle"
                          >
                            {s.name}
                          </text>
                        </>
                      )}
                    </g>
                  ))}

                  <polyline
                    points="-122,-240 -122,242 200,242"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3.5"
                    strokeDasharray="8 5"
                  />

                  {NAIROBI_ROUNDABOUTS.map((rb) => (
                    <circle
                      key={rb.id}
                      cx={rb.x}
                      cy={rb.z}
                      r={rb.outerRadius * 0.65}
                      fill="#1e293b"
                      stroke="#94a3b8"
                      strokeWidth="2"
                    />
                  ))}

                  {NAIROBI_LANDMARKS.map((lm) => {
                    const isSel = lm.id === selectedLm.id;
                    const isTarget = lm.id === activeLandmarkId;
                    const labelBelow = lm.id === 'parliament' || lm.id === 'uhuru-park';
                    return (
                      <g
                        key={lm.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedLm(lm)}
                      >
                        <circle
                          cx={lm.x}
                          cy={lm.z}
                          r={isSel ? 13 : 9}
                          fill={isTarget ? '#f59e0b' : isSel ? '#10b981' : '#38bdf8'}
                          fillOpacity="0.28"
                        />
                        <circle
                          cx={lm.x}
                          cy={lm.z}
                          r={isSel ? 6.5 : 4.8}
                          fill={isTarget ? '#f59e0b' : isSel ? '#10b981' : '#e2e8f0'}
                          stroke="#0f1419"
                          strokeWidth="2"
                        />
                        <text
                          x={lm.x}
                          y={labelBelow ? lm.z + 15 : lm.z - 10}
                          fill="#f8fafc"
                          fontSize="8.5"
                          fontWeight="600"
                          textAnchor="middle"
                        >
                          {lm.shortName}
                        </text>
                      </g>
                    );
                  })}

                  {playerPos && (
                    <circle
                      cx={playerPos.x}
                      cy={playerPos.z}
                      r="6"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                  )}
                </svg>
              </div>

              {/* Selected Landmark Details + Quick List */}
              <div className="md:col-span-5 flex flex-col gap-4">
                <div className="bg-[#151c24] border border-white/10 rounded-xl p-4">
                  <div className="text-xs font-semibold text-amber-400">
                    {selectedLm.district} · {selectedLm.street}
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">{selectedLm.name}</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">{selectedLm.summary}</p>
                  <div className="mt-3 p-2.5 rounded-lg bg-black/35 border border-white/10 text-xs text-emerald-300">
                    <span className="font-semibold text-emerald-400">Wayfinding Tip: </span>
                    {selectedLm.wayfindingTip}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDestination(selectedLm.id);
                        onClose();
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Set GPS Route</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onTeleportToLandmark(selectedLm.id);
                        onClose();
                      }}
                      className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs cursor-pointer"
                    >
                      Drive Here
                    </button>
                  </div>
                </div>

                <div className="bg-[#151c24] border border-white/10 rounded-xl p-3 max-h-64 overflow-y-auto space-y-1">
                  {NAIROBI_LANDMARKS.map((lm) => (
                    <button
                      key={lm.id}
                      type="button"
                      onClick={() => setSelectedLm(lm)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer ${
                        lm.id === selectedLm.id
                          ? 'bg-amber-500/15 text-amber-300 font-semibold'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{lm.shortName}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{lm.street.split('/')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'explore' && (
            <div className="space-y-4">
              <div className="bg-[#151c24] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">
                    Ask Gemini 3.8 Flash about Nairobi Streets &amp; Places
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setExploreMode('maps')}
                      className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                        exploreMode === 'maps' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
                      }`}
                    >
                      Maps Grounding
                    </button>
                    <button
                      type="button"
                      onClick={() => setExploreMode('search')}
                      className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                        exploreMode === 'search' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                      }`}
                    >
                      Search Grounding
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={exploreQuery}
                    onChange={(e) => setExploreQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') runExplore();
                    }}
                    placeholder="e.g. Best route from Uhuru Highway to Kenya National Archives"
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-black/50 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    disabled={exploreLoading}
                    onClick={runExplore}
                    className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm cursor-pointer whitespace-nowrap"
                  >
                    {exploreLoading ? 'Searching...' : 'Ask Guide'}
                  </button>
                </div>

                {exploreError && (
                  <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-400/40 text-xs text-rose-200">
                    {exploreError}
                  </div>
                )}
              </div>

              {exploreResult && (
                <div className="bg-[#151c24] border border-white/10 rounded-xl p-4 space-y-4">
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {exploreResult.text}
                  </div>

                  {exploreResult.mapLinks.length > 0 && (
                    <div className="pt-3 border-t border-white/10">
                      <div className="text-xs font-semibold text-emerald-400 mb-2">
                        Grounded Google Maps Places
                      </div>
                      <div className="space-y-2">
                        {exploreResult.mapLinks.map((m, i) => (
                          <a
                            key={i}
                            href={m.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-black/35 border border-white/10 hover:border-emerald-400/50 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{m.title}</span>
                              </div>
                              {m.snippet && <p className="text-slate-400 mt-1">{m.snippet}</p>}
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {exploreResult.webLinks.length > 0 && (
                    <div className="pt-3 border-t border-white/10">
                      <div className="text-xs font-semibold text-amber-400 mb-2">Search Sources</div>
                      <div className="flex flex-wrap gap-2">
                        {exploreResult.webLinks.map((w, i) => (
                          <a
                            key={i}
                            href={w.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/35 border border-white/10 hover:border-amber-400/50 text-xs text-slate-200"
                          >
                            <span className="truncate max-w-[220px]">{w.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'studio' && (
            <div className="space-y-6">
              {/* Image Generation & Editing */}
              <div className="bg-[#151c24] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <ImageIcon className="w-4 h-4 text-sky-400" />
                  <span>Nairobi Street &amp; Livery Image Studio</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1" htmlFor="img-model">
                      Model
                    </label>
                    <select
                      id="img-model"
                      value={imageModel}
                      onChange={(e) =>
                        setImageModel(
                          e.target.value as 'gemini-nano-banana-2.1' | 'gemini-3-pro-image-preview',
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
                    >
                      <option value="gemini-nano-banana-2.1">Nano Banana 2.1 (Create &amp; Edit)</option>
                      <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image Preview</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1" htmlFor="img-size">
                      Resolution
                    </label>
                    <select
                      id="img-size"
                      value={imageSize}
                      onChange={(e) => setImageSize(e.target.value as '1K' | '2K' | '4K')}
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
                    >
                      <option value="1K">1K Standard</option>
                      <option value="2K">2K High-Res</option>
                      <option value="4K">4K Ultra-HD</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1" htmlFor="img-prompt">
                    Prompt
                  </label>
                  <textarea
                    id="img-prompt"
                    rows={2}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="text-xs text-slate-300 cursor-pointer">
                    <span className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 inline-block">
                      {editSourceBase64 ? 'Reference Photo Attached' : 'Optional Photo to Edit'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileRead(e, (b64, mime) => {
                          setEditSourceBase64(b64);
                          setEditSourceMime(mime);
                        })
                      }
                    />
                  </label>

                  <button
                    type="button"
                    disabled={imageLoading}
                    onClick={runGenerateImage}
                    className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    {imageLoading ? 'Generating...' : 'Generate Image'}
                  </button>
                </div>

                {imageError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-400/40 text-xs text-rose-200">
                    {imageError}
                  </div>
                )}

                {generatedImageUrl && (
                  <img
                    src={generatedImageUrl}
                    alt="Generated Nairobi visual"
                    className="w-full rounded-lg border border-white/15 mt-2"
                  />
                )}
              </div>

              {/* Photo-to-Video Animation (Gemini Omni 1.2 Flash) */}
              <div className="bg-[#151c24] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Film className="w-4 h-4 text-amber-400" />
                  <span>Animate Photo into Video (Omni 1.2 Flash)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1" htmlFor="vid-photo">
                      Upload Photo
                    </label>
                    <input
                      id="vid-photo"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleFileRead(e, (b64, mime, dataUrl) => {
                          setVideoPhotoBase64(b64);
                          setVideoPhotoMime(mime);
                          setVideoPhotoPreview(dataUrl);
                        })
                      }
                      className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1" htmlFor="vid-aspect">
                      Video Aspect Ratio
                    </label>
                    <select
                      id="vid-aspect"
                      value={videoAspect}
                      onChange={(e) => setVideoAspect(e.target.value as '16:9' | '9:16')}
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
                    >
                      <option value="16:9">16:9 Landscape</option>
                      <option value="9:16">9:16 Portrait</option>
                    </select>
                  </div>
                </div>

                {videoPhotoPreview && (
                  <img
                    src={videoPhotoPreview}
                    alt="Source frame for Nairobi video"
                    className="max-h-40 rounded-lg border border-white/15 object-cover"
                  />
                )}

                <div>
                  <label className="block text-xs text-slate-400 mb-1" htmlFor="vid-prompt">
                    Motion Prompt
                  </label>
                  <input
                    id="vid-prompt"
                    type="text"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={videoLoading}
                    onClick={runAnimateVideo}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    {videoLoading ? 'Animating Video...' : 'Animate Photo'}
                  </button>
                </div>

                {videoError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-400/40 text-xs text-rose-200">
                    {videoError}
                  </div>
                )}

                {generatedVideoUrl && (
                  <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full rounded-lg border border-white/15 mt-2"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
