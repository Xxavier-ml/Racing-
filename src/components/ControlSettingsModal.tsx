import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { DEFAULT_CONTROL_SETTINGS, type ControlSettings } from '../game/controlSettings';

interface ControlSettingsModalProps {
  open: boolean;
  settings: ControlSettings;
  onChange: (next: ControlSettings) => void;
  onClose: () => void;
}

export function ControlSettingsModal({
  open,
  settings,
  onChange,
  onClose,
}: ControlSettingsModalProps) {
  if (!open) return null;

  const update = <K extends keyof ControlSettings>(key: K, value: ControlSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const applyPreset = (steering: number, accel: number, brake: number) => {
    onChange({
      ...settings,
      steeringSensitivity: steering,
      accelSensitivity: accel,
      brakeSensitivity: brake,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="control-settings-heading"
        data-testid="control-settings-modal"
        className="w-full max-w-md bg-[#0c1117] border border-white/15 rounded-xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-amber-400" />
            <h2
              id="control-settings-heading"
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'Chakra Petch, sans-serif' }}
            >
              CONTROLS & SENSITIVITY
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close control settings"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Auto-Drive Cruise Toggle */}
          <div className="bg-black/45 border border-white/10 rounded-lg p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Auto-Drive Cruise</div>
                <div className="text-[11px] text-slate-400">
                  Car moves automatically after GO! Hold W/↑ to Accelerate or S/↓ to Brake.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoDrive}
                data-testid="toggle-autodrive"
                onClick={() => update('autoDrive', !settings.autoDrive)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase cursor-pointer shrink-0 transition-colors ${
                  settings.autoDrive
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-white/10 text-slate-300 border border-white/15'
                }`}
              >
                {settings.autoDrive ? 'ON' : 'OFF'}
              </button>
            </div>

            {settings.autoDrive && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Auto-Cruise Pace</span>
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">
                    {Math.round(settings.cruiseSpeedRatio * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.35}
                  max={0.75}
                  step={0.05}
                  value={settings.cruiseSpeedRatio}
                  aria-label="Auto-Cruise Pace"
                  onChange={(e) => update('cruiseSpeedRatio', parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Steering Sensitivity */}
          <div className="bg-black/45 border border-white/10 rounded-lg p-3.5 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-200 font-medium">Steering Sensitivity</span>
                <span
                  data-testid="steering-sensitivity-val"
                  className="font-mono font-bold text-amber-400 tabular-nums"
                >
                  {settings.steeringSensitivity.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.8}
                step={0.05}
                value={settings.steeringSensitivity}
                aria-label="Steering Sensitivity"
                data-testid="steering-sensitivity-slider"
                onChange={(e) => update('steeringSensitivity', parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-200 font-medium">Accelerate Response</span>
                <span
                  data-testid="accel-sensitivity-val"
                  className="font-mono font-bold text-emerald-400 tabular-nums"
                >
                  {settings.accelSensitivity.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={settings.accelSensitivity}
                aria-label="Accelerate Response"
                data-testid="accel-sensitivity-slider"
                onChange={(e) => update('accelSensitivity', parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-200 font-medium">Brake Force</span>
                <span
                  data-testid="brake-sensitivity-val"
                  className="font-mono font-bold text-rose-400 tabular-nums"
                >
                  {settings.brakeSensitivity.toFixed(2)}×
                </span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={settings.brakeSensitivity}
                aria-label="Brake Force"
                data-testid="brake-sensitivity-slider"
                onChange={(e) => update('brakeSensitivity', parseFloat(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Handling Presets */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyPreset(0.75, 0.9, 1.0)}
              className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Precision 0.75×
            </button>
            <button
              type="button"
              onClick={() => applyPreset(1.0, 1.0, 1.0)}
              className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Balanced 1.00×
            </button>
            <button
              type="button"
              onClick={() => applyPreset(1.35, 1.2, 1.15)}
              className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Agile 1.35×
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_CONTROL_SETTINGS })}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
