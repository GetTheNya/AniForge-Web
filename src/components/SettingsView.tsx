import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';

const LANGUAGES = [
  { code: 'en', flagCode: 'us', labelKey: 'settings.english' },
  { code: 'uk', flagCode: 'ua', labelKey: 'settings.ukrainian' },
] as const;

export default function SettingsView() {
  const { t } = useTranslation();
  const { language, setLanguage, preferUkTitles, setPreferUkTitles } = useSettings();
  const { user, profile, isLoading: authLoading, signInWithGoogle, signOut, refreshProfile } = useAuth();
  const { addToast: showToast } = useToast();

  // Sync page title to document.title
  useEffect(() => {
    document.title = `${t('settings.title', 'Settings')} - AniForge Web`;
  }, [t]);

  // Username edit states
  const [usernameInput, setUsernameInput] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Avatar upload states
  const [selectedFileSrc, setSelectedFileSrc] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar Cropper Modal state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropperImgRef = useRef<HTMLImageElement>(null);
  const cropAreaRef = useRef<HTMLDivElement>(null);

  // Cropper transition animation states
  const [shouldRenderCropper, setShouldRenderCropper] = useState(false);
  const [isCropperVisible, setIsCropperVisible] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (selectedFileSrc) {
      setShouldRenderCropper(true);
      const timer = setTimeout(() => setIsCropperVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsCropperVisible(false);
      const timer = setTimeout(() => setShouldRenderCropper(false), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedFileSrc]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedFileSrc && !isUploadingAvatar) {
        setSelectedFileSrc(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileSrc, isUploadingAvatar]);

  // Lock page scrolling when cropper is open
  useEffect(() => {
    if (shouldRenderCropper) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [shouldRenderCropper]);

  // Sync profile data to input
  useEffect(() => {
    if (profile?.username) {
      setUsernameInput(profile.username);
    } else if (user?.email) {
      setUsernameInput(user.email.split('@')[0]);
    }
  }, [profile, user]);

  // Username validation
  const validateUsername = (val: string): string | null => {
    if (val.length < 3) {
      return t('accountSettings.errorTooShort');
    }
    if (val.length > 15) {
      return t('accountSettings.errorTooLong');
    }
    // Only letters, digits, period, underscore, hyphen
    const regex = /^[a-zA-Z0-9._-]+$/;
    if (!regex.test(val)) {
      return t('accountSettings.errorInvalidChars');
    }
    return null;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUsernameInput(val);
    setUsernameError(validateUsername(val));
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    const validationError = validateUsername(usernameInput);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    setIsSavingUsername(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: usernameInput })
        .eq('id', user.id);

      if (error) {
        // Postgres unique key violation code: 23505
        if (error.code === '23505') {
          setUsernameError(t('accountSettings.errorAlreadyTaken'));
        } else {
          throw error;
        }
      } else {
        showToast(t('accountSettings.success'), 'success');
        await refreshProfile();
      }
    } catch (err: any) {
      console.error('[settings] Error saving username:', err);
      showToast(t('accountSettings.errorGeneric'), 'error');
    } finally {
      setIsSavingUsername(false);
    }
  };

  // Avatar Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedFileSrc(reader.result as string);
        setImgNaturalSize({ width: 0, height: 0 });
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  // Dynamic base dimensions calculation based on natural size
  const baseImageSize = useMemo(() => {
    if (!imgNaturalSize.width || !imgNaturalSize.height) {
      return { width: 256, height: 256 };
    }
    const isLandscape = imgNaturalSize.width > imgNaturalSize.height;
    if (isLandscape) {
      return {
        height: 256,
        width: 256 * (imgNaturalSize.width / imgNaturalSize.height),
      };
    } else {
      return {
        width: 256,
        height: 256 * (imgNaturalSize.height / imgNaturalSize.width),
      };
    }
  }, [imgNaturalSize]);

  // Constrain panning to keep crop circle (centered, radius 128) fully within the image
  const getConstrainedPan = useCallback((x: number, y: number, currentZoom: number) => {
    const w = baseImageSize.width * currentZoom;
    const h = baseImageSize.height * currentZoom;
    const r = 128; // crop circle radius (diameter = 256)

    const maxX = w / 2 - r;
    const minX = -maxX;
    const clampedX = Math.min(Math.max(x, minX), maxX);

    const maxY = h / 2 - r;
    const minY = -maxY;
    const clampedY = Math.min(Math.max(y, minY), maxY);

    return { x: clampedX, y: clampedY };
  }, [baseImageSize]);

  // Scroll wheel zoom handler
  useEffect(() => {
    const container = cropAreaRef.current;
    if (!container) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.05;
      const direction = e.deltaY < 0 ? 1 : -1;
      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(prevZoom + direction * zoomFactor, 1), 5);
        setPanOffset((prevPan) => getConstrainedPan(prevPan.x, prevPan.y, newZoom));
        return newZoom;
      });
    };

    container.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelEvent);
    };
  }, [shouldRenderCropper, getConstrainedPan]);

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setPanOffset((prev) => getConstrainedPan(prev.x, prev.y, newZoom));
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Drag handlers for cropper
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPanOffset(getConstrainedPan(newX, newY, zoom));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;
    setPanOffset(getConstrainedPan(newX, newY, zoom));
  };

  // Perform canvas crop and upload
  const handleCropAndUpload = async () => {
    if (!user || !selectedFileSrc || !cropperImgRef.current) return;
    setIsUploadingAvatar(true);

    try {
      const img = cropperImgRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Could not get canvas context');

      const displayW = img.offsetWidth;
      const displayH = img.offsetHeight;

      // Clear
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 256, 256);

      // Translate context to center of target crop circle + custom pan offsets
      ctx.translate(128 + panOffset.x, 128 + panOffset.y);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, -displayW / 2, -displayH / 2, displayW, displayH);

      // Export as WebP
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            showToast(t('accountSettings.cropProcessFailed'), 'error');
            setIsUploadingAvatar(false);
            return;
          }

          try {
            // Upload to Supabase Storage: avatars bucket
            const path = `${user.id}/avatar.webp`;
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(path, blob, { upsert: true });

            if (uploadError) throw uploadError;

            showToast(t('accountSettings.avatarUpdateSuccess'), 'success');
            await refreshProfile();
            setSelectedFileSrc(null); // Close modal
          } catch (uploadErr: any) {
            console.error('[settings] Avatar upload error:', uploadErr);
            showToast(t('accountSettings.avatarUploadFailed', { error: uploadErr.message }), 'error');
          } finally {
            setIsUploadingAvatar(false);
          }
        },
        'image/webp',
        0.85
      );
    } catch (err: any) {
      console.error('[settings] Crop failed:', err);
      showToast(t('accountSettings.cropError'), 'error');
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-[var(--color-text-primary)]">
          {t('settings.title')}
        </h2>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
          {t('settings.subtext')}
        </p>
      </div>

      {/* Main Preference Settings Card */}
      <div className="glass-card p-6 space-y-6 relative overflow-hidden backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-accent-primary)]/5 rounded-full filter blur-3xl pointer-events-none -mr-32 -mt-32" />

        {/* Language Selection */}
        <div className="space-y-3 relative z-10">
          <label className="text-sm font-bold text-[var(--color-text-primary)]">
            {t('settings.language')}
          </label>
          <div className="flex gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer select-none flex items-center justify-center gap-2 ${
                  language === lang.code
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] shadow-[0_0_12px_rgba(var(--color-accent-primary-rgb),0.25)]'
                    : 'border-[var(--color-border-glass)] bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card-hover)]'
                }`}
              >
                <img
                  src={`https://flagcdn.com/${lang.flagCode}.svg`}
                  className="w-5 h-3.5 rounded-sm object-cover shadow-sm border border-white/10 shrink-0"
                  alt={`${lang.flagCode} flag`}
                  loading="lazy"
                />
                <span>{t(lang.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <hr className="border-[var(--color-border-glass)] relative z-10" />

        {/* Prefer Ukrainian Titles Toggle */}
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <label className="text-sm font-bold text-[var(--color-text-primary)] cursor-pointer" htmlFor="prefer-uk-toggle">
              {t('settings.preferUk')}
            </label>
            <p className="text-xs text-[var(--color-text-tertiary)] max-w-lg leading-relaxed">
              {t('settings.preferUkSubtext')}
            </p>
          </div>
          
          <label htmlFor="prefer-uk-toggle" className="relative inline-flex items-center cursor-pointer mt-1">
            <input
              type="checkbox"
              id="prefer-uk-toggle"
              checked={preferUkTitles}
              onChange={(e) => setPreferUkTitles(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[var(--color-text-secondary)] peer-checked:after:bg-[var(--color-accent-primary)] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-accent-primary)]/10 peer-checked:border-[var(--color-accent-primary)]"></div>
          </label>
        </div>
      </div>

      {/* Account Settings / Sync Section */}
      <div className="glass-card p-6 space-y-6 relative overflow-hidden backdrop-blur-xl bg-[#0C0C0E]/60 border border-[var(--color-border-glass)]">
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--color-accent-secondary)]/5 rounded-full filter blur-3xl pointer-events-none -ml-32 -mb-32" />

        <div className="relative z-10">
          <h3 className="text-md font-bold text-[var(--color-text-primary)] mb-1">
            {t('accountSettings.title')}
          </h3>
        </div>

        {authLoading ? (
          <div className="py-4 text-center text-xs text-[var(--color-text-secondary)]">
            {t('common.loading')}
          </div>
        ) : !user ? (
          <div className="space-y-4 text-center py-6 relative z-10">
            <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
              {t('detail.signInDetails')}
            </p>
            <button
              onClick={signInWithGoogle}
              className="flex items-center justify-center gap-3 px-6 py-3 rounded-xl border border-[var(--color-border-glass)] bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-card-hover)] text-xs font-bold text-white transition-all cursor-pointer mx-auto shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#fff"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#fff"
                  opacity=".8"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#fff"
                  opacity=".6"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#fff"
                  opacity=".4"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{t('common.signInGoogle')}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6 relative z-10">
            {/* Avatar Row */}
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2 border-[var(--color-border-glass)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] font-bold text-xl select-none shrink-0 shadow-md">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span>{(profile?.username || user.email?.split('@')[0] || 'U')[0].toUpperCase()}</span>
                )}
              </div>

              <div className="space-y-2 flex-1">
                <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  {t('accountSettings.avatarLabel')}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="glass-badge py-1.5 px-3 bg-[var(--color-bg-input)] border-[var(--color-border-glass)] text-[var(--color-text-primary)] hover:border-white transition-all cursor-pointer text-xs font-semibold"
                  >
                    {t('accountSettings.avatarChangeBtnPhoto')}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <hr className="border-[var(--color-border-glass)]" />

            {/* Username Form */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-[var(--color-text-secondary)]">
                {t('accountSettings.usernameLabel')}
              </label>
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={handleUsernameChange}
                  placeholder={t('accountSettings.usernamePlaceholder')}
                  disabled={isSavingUsername}
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] disabled:opacity-50"
                />
                {usernameError && (
                  <span className="text-[10px] text-[var(--color-accent-rose)] font-semibold mt-1 px-1">
                    {usernameError}
                  </span>
                )}
              </div>

              <button
                onClick={handleSaveUsername}
                disabled={isSavingUsername || !!usernameError || usernameInput === profile?.username}
                className="w-full py-3 rounded-xl text-xs font-bold bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/80 text-white cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSavingUsername && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{t('accountSettings.save')}</span>
              </button>
            </div>

            <hr className="border-[var(--color-border-glass)]" />

            {/* Sign Out Button */}
            <button
              onClick={() => {
                if (window.confirm(t('accountSettings.signOutConfirmText'))) {
                  signOut();
                }
              }}
              className="w-full py-3 rounded-xl text-xs font-bold bg-[var(--color-accent-rose)]/10 border border-[var(--color-accent-rose)]/30 hover:bg-[var(--color-accent-rose)] hover:text-white text-[var(--color-accent-rose)] cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              🚪 {t('accountSettings.signOut')}
            </button>
          </div>
        )}
      </div>

      {/* Image Cropper Modal */}
      {shouldRenderCropper && selectedFileSrc && createPortal(
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 transition-all duration-300 ease-out ${
            isCropperVisible ? 'opacity-100 backdrop-blur-md' : 'opacity-0 backdrop-blur-none'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUploadingAvatar) {
              setSelectedFileSrc(null);
            }
          }}
        >
          <div
            className={`glass-card max-w-xl w-full p-6 relative bg-[var(--color-bg-elevated)] border border-[var(--color-border-glass)] rounded-2xl shadow-2xl space-y-6 flex flex-col items-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              isCropperVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] w-full text-left">
              {t('accountSettings.avatarEditDialogTitle')}
            </h3>

            {/* Crop area wrapper */}
            <div
              ref={cropAreaRef}
              className="w-[320px] h-[320px] border border-[var(--color-border-glass)] rounded-xl relative overflow-hidden bg-black flex items-center justify-center select-none cursor-move touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              {/* Dimmed Radial Gradient Preview Overlay */}
              <div
                className="absolute inset-0 pointer-events-none rounded-xl"
                style={{
                  background: 'radial-gradient(circle 128px at center, transparent 128px, rgba(0, 0, 0, 0.75) 129px)',
                  zIndex: 2,
                }}
              />

              {/* User selected image */}
              <img
                ref={cropperImgRef}
                src={selectedFileSrc}
                alt="Crop preview"
                onLoad={handleImageLoad}
                className="max-w-none max-h-none pointer-events-none select-none transition-transform duration-75 ease-out"
                style={{
                  width: `${baseImageSize.width}px`,
                  height: `${baseImageSize.height}px`,
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                  zIndex: 1,
                }}
              />
            </div>

            {/* Zoom Slider */}
            <div className="w-full space-y-2">
              <div className="flex justify-between text-[10px] font-semibold text-[var(--color-text-secondary)] px-1">
                <span>{t('accountSettings.cropZoom')}</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.05"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-full accent-[var(--color-accent-primary)] h-1 bg-[var(--color-bg-input)] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 w-full">
              <button
                disabled={isUploadingAvatar}
                onClick={() => setSelectedFileSrc(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[var(--color-bg-input)] border border-[var(--color-border-glass)] hover:border-white text-[var(--color-text-primary)] cursor-pointer disabled:opacity-50 transition-all"
              >
                {t('accountSettings.avatarCancel')}
              </button>
              <button
                disabled={isUploadingAvatar}
                onClick={handleCropAndUpload}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/80 text-white cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {isUploadingAvatar ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>💾</span>
                )}
                <span>{t('accountSettings.avatarSave')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
