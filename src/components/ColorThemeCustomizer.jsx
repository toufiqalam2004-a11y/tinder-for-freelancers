import React, { useState, useMemo } from 'react';
import { 
  Palette, Check, RotateCcw, AlertTriangle, CheckCircle, 
  Sparkles, Eye, Sliders, Briefcase, Bookmark, ArrowRight, Lock, Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { evaluateContrast, DEFAULT_CUSTOM_COLORS } from '../utils/themePalettes';
import { subscriptionService } from '../services/subscriptionService';
import UpgradeModal from './UpgradeModal';

export default function ColorThemeCustomizer() {
  const {
    effectiveTheme,
    colorTheme,
    setColorTheme,
    customColors,
    setCustomColors,
    resetCustomColors,
    presets,
  } = useTheme();

  const isDark = effectiveTheme === 'dark';

  // Local draft state for Custom Theme pickers so user can tweak & preview before applying
  const [draftColors, setDraftColors] = useState(() => customColors || DEFAULT_CUSTOM_COLORS);
  const [isCustomExpanded, setIsCustomExpanded] = useState(colorTheme === 'custom');

  // Contrast analysis for current draft custom colors
  const contrastAnalysis = useMemo(() => {
    return evaluateContrast(draftColors.text, draftColors.background, draftColors.surface);
  }, [draftColors]);

  // Handle color change in local draft
  const handleColorChange = (key, value) => {
    setDraftColors((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Apply custom colors globally
  const handleApplyCustom = () => {
    setCustomColors(draftColors);
    setColorTheme('custom');
    toast.success('Custom color theme applied!');
  };

  // Reset to default brand
  const handleReset = () => {
    setDraftColors(DEFAULT_CUSTOM_COLORS);
    resetCustomColors();
    toast.success('Theme reset to Tinder for Freelancers default (Pink + Beige).');
  };

  // Color inputs definition
  const COLOR_INPUTS = [
    { key: 'primary', label: 'Primary Color', desc: 'Buttons, badges, highlights' },
    { key: 'secondary', label: 'Secondary Color', desc: 'Accents, warm badges, borders' },
    { key: 'background', label: 'Background Color', desc: 'Main screen background' },
    { key: 'surface', label: 'Surface / Card', desc: 'Job cards, modals, headers' },
    { key: 'text', label: 'Text Color', desc: 'Headings, readable text' },
    { key: 'accent', label: 'Accent Color', desc: 'Action tags, active glow' },
  ];

  // Subscription Gating checks
  const allowedPresets = subscriptionService.getAllowedThemePresetIds();
  const customThemeCheck = subscriptionService.canUseCustomTheme();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <Palette size={14} className="text-primary" />
            <span>Color Theme</span>
          </div>
          <p className="text-[11px] text-text-secondary mt-0.5">
            Choose your preferred color combination.
          </p>
        </div>

        {colorTheme === 'custom' && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Custom Active
          </span>
        )}
      </div>

      {/* Preset Palette Selection Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {presets.map((preset) => {
          const isSelected = colorTheme === preset.id;
          const currentVariant = isDark ? preset.dark : preset.light;
          const isLocked = !allowedPresets.includes(preset.id);

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (isLocked) {
                  setUpgradeReason('This theme preset is exclusive to Plus and Pro plans. Upgrade to unlock all 6 curated themes.');
                  setShowUpgradeModal(true);
                  return;
                }
                setColorTheme(preset.id);
                toast.success(`Theme set to ${preset.name}`);
              }}
              className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected
                  ? 'border-primary shadow-sm ring-1 ring-primary/40 bg-surface'
                  : 'border-border bg-surface hover:bg-surface-hover/80 hover:border-border/80'
              }`}
            >
              {/* Locked Pill */}
              {isLocked && (
                <div className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold">
                  <Lock size={10} />
                  <span>PLUS</span>
                </div>
              )}

              {/* Color Swatch Bar */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <div
                  className="w-5 h-5 rounded-full border border-black/10 shadow-xs flex-shrink-0"
                  style={{ backgroundColor: currentVariant.primary }}
                  title={`Primary: ${currentVariant.primary}`}
                />
                <div
                  className="w-5 h-5 rounded-full border border-black/10 shadow-xs flex-shrink-0"
                  style={{ backgroundColor: currentVariant.secondary }}
                  title={`Secondary: ${currentVariant.secondary}`}
                />
                <div
                  className="w-5 h-5 rounded-full border border-black/10 shadow-xs flex-shrink-0"
                  style={{ backgroundColor: currentVariant.background }}
                  title={`Background: ${currentVariant.background}`}
                />
                <div
                  className="w-5 h-5 rounded-full border border-black/10 shadow-xs flex-shrink-0"
                  style={{ backgroundColor: currentVariant.surface }}
                  title={`Surface: ${currentVariant.surface}`}
                />
              </div>

              <div>
                <div className="text-xs font-bold text-text-primary flex items-center justify-between">
                  <span className="truncate pr-1">{preset.name}</span>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
                      <Check size={10} />
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-text-muted truncate mt-0.5">
                  {preset.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Theme Toggle Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            if (!customThemeCheck.allowed) {
              setUpgradeReason(customThemeCheck.reason);
              setShowUpgradeModal(true);
              return;
            }
            setIsCustomExpanded(!isCustomExpanded);
          }}
          className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
            colorTheme === 'custom' || isCustomExpanded
              ? 'border-primary/50 bg-primary/5'
              : 'border-border bg-surface hover:bg-surface-hover'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Sliders size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <span>Custom Theme Builder</span>
                {!customThemeCheck.allowed && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
                    <Lock size={9} /> PRO
                  </span>
                )}
              </div>
              <div className="text-[10px] text-text-muted">
                Fine-tune primary, secondary, background, and text colors
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-primary">
            {!customThemeCheck.allowed ? 'Unlock' : isCustomExpanded ? 'Collapse' : 'Customize'}
          </span>
        </button>
      </div>

      {/* Expandable Custom Theme Editor */}
      <AnimatePresence>
        {isCustomExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-4"
          >
            <div className="p-4 rounded-2xl bg-surface-hover/60 border border-border space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COLOR_INPUTS.map((item) => {
                  const val = draftColors[item.key] || '#000000';

                  return (
                    <div
                      key={item.key}
                      className="p-2.5 rounded-xl bg-surface border border-border shadow-xs"
                    >
                      <label className="block text-[11px] font-bold text-text-primary mb-1">
                        {item.label}
                      </label>
                      <div className="flex items-center gap-2">
                        {/* Native color picker box */}
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-border shadow-inner flex-shrink-0 cursor-pointer">
                          <input
                            type="color"
                            value={val}
                            onChange={(e) => handleColorChange(item.key, e.target.value)}
                            aria-label={item.label}
                            className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer opacity-0"
                          />
                          <div
                            className="w-full h-full"
                            style={{ backgroundColor: val }}
                          />
                        </div>

                        {/* Hex text input */}
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleColorChange(item.key, e.target.value)}
                          maxLength={7}
                          className="w-full text-xs font-mono font-bold uppercase bg-transparent text-text-primary focus:outline-none"
                        />
                      </div>
                      <span className="text-[9px] text-text-muted mt-1 block">
                        {item.desc}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Contrast Warning or Validation Badge */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  contrastAnalysis.status === 'fail'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                    : contrastAnalysis.status === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {contrastAnalysis.status === 'fail' ? (
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                ) : contrastAnalysis.status === 'warning' ? (
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                )}

                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>
                      {contrastAnalysis.status === 'fail'
                        ? 'Low Contrast Warning'
                        : contrastAnalysis.status === 'warning'
                        ? 'Moderate Contrast'
                        : 'Great Contrast Ratio'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/10 dark:bg-white/10">
                      {contrastAnalysis.lowestRatio}:1
                    </span>
                  </div>
                  <div className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                    {contrastAnalysis.warningMessage ||
                      'Text is easily readable against background and card surfaces.'}
                  </div>
                </div>
              </div>

              {/* Live Interactive Preview Box */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1">
                  <Eye size={13} className="text-primary" /> Live Palette Preview
                </div>

                {/* Simulated App Container with custom colors */}
                <div
                  className="p-3.5 rounded-2xl border shadow-sm transition-all"
                  style={{
                    backgroundColor: draftColors.background,
                    borderColor: draftColors.secondary,
                    color: draftColors.text,
                  }}
                >
                  {/* Mock Mini Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-black/10 dark:border-white/10 text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] text-white"
                        style={{ backgroundColor: draftColors.primary }}
                      >
                        TF
                      </div>
                      <span className="font-bold" style={{ color: draftColors.text }}>
                        Tinder for Freelancers
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${draftColors.primary}22`,
                        color: draftColors.primary,
                      }}
                    >
                      95% Match
                    </span>
                  </div>

                  {/* Mock Card */}
                  <div
                    className="p-3 rounded-xl border mb-3 shadow-xs"
                    style={{
                      backgroundColor: draftColors.surface,
                      borderColor: `${draftColors.secondary}55`,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div
                          className="font-bold text-xs"
                          style={{ color: draftColors.text }}
                        >
                          Senior Video Editor & Motion Designer
                        </div>
                        <div
                          className="text-[10px] mt-0.5 opacity-80"
                          style={{ color: draftColors.text }}
                        >
                          YouTube Creator Studio • $2,500/project
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5 mt-2 text-[10px]">
                      <span
                        className="px-2 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: `${draftColors.secondary}25`,
                          color: draftColors.text,
                        }}
                      >
                        Remote
                      </span>
                      <span
                        className="px-2 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: `${draftColors.accent}20`,
                          color: draftColors.accent,
                        }}
                      >
                        Premiere Pro
                      </span>
                    </div>
                  </div>

                  {/* Mock Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-white shadow-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                      style={{ backgroundColor: draftColors.primary }}
                    >
                      <span>Apply Now</span>
                      <ArrowRight size={12} />
                    </button>

                    <button
                      type="button"
                      className="px-3 py-2 rounded-xl text-xs font-semibold border shadow-xs transition-transform active:scale-95"
                      style={{
                        backgroundColor: draftColors.surface,
                        borderColor: `${draftColors.secondary}80`,
                        color: draftColors.text,
                      }}
                    >
                      <Bookmark size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Apply & Reset */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white font-bold text-xs shadow-sm hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Apply Custom Theme</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="py-2.5 px-3.5 rounded-xl border border-border bg-surface text-text-secondary font-medium text-xs hover:bg-surface-hover hover:text-text-primary transition-all flex items-center justify-center gap-1.5"
                  title="Reset to Tinder for Freelancers default"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Theme Customization Gated"
        message={upgradeReason}
      />
    </div>
  );
}
