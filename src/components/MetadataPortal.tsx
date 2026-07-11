/**
 * MetadataPortal — Sleek overlay browser/portal for tags, studios, and staff members.
 * Allows searching/filtering the complete lists and toggling active/excluded states.
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';
import type { Tag, Studio, Staff } from '../types/anime';
import type { SearchFilterQuery } from '../types/filters';

interface MetadataPortalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'tags' | 'studios' | 'staff';
  tags: Tag[];
  studios: Studio[];
  staff: Staff[];
  filter: SearchFilterQuery;
  onChange: (filter: SearchFilterQuery) => void;
}

export default function MetadataPortal({
  isOpen,
  onClose,
  initialTab = 'tags',
  tags,
  studios,
  staff,
  filter,
  onChange,
}: MetadataPortalProps) {
  const { t } = useTranslation();
  const { preferUkTitles } = useSettings();
  const [activeTab, setActiveTab] = useState<'tags' | 'studios' | 'staff'>('tags');
  const [search, setSearch] = useState('');

  // Exit animation states
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setSearch('');
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen, initialTab]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  // Filter items based on active tab and search query
  const getFilteredItems = () => {
    const term = search.toLowerCase().trim();
    switch (activeTab) {
      case 'tags':
        return tags.filter(
          (item) =>
            item.name_en.toLowerCase().includes(term) ||
            (item.name_uk && item.name_uk.toLowerCase().includes(term)),
        );
      case 'studios':
        return studios.filter((item) => item.name.toLowerCase().includes(term));
      case 'staff':
        return staff.filter((item) => item.full_name.toLowerCase().includes(term));
      default:
        return [];
    }
  };

  const filtered = getFilteredItems();

  const handleItemToggle = (type: 'tags' | 'studios' | 'staff', id: number) => {
    if (type === 'tags') {
      const isExcluded = filter.excludedTags.includes(id);
      const isActive = filter.tags.includes(id);
      if (isExcluded) {
        onChange({ ...filter, excludedTags: filter.excludedTags.filter((x) => x !== id) });
      } else if (isActive) {
        onChange({
          ...filter,
          tags: filter.tags.filter((x) => x !== id),
          excludedTags: [...filter.excludedTags, id],
        });
      } else {
        onChange({ ...filter, tags: [...filter.tags, id] });
      }
    } else if (type === 'studios') {
      const isExcluded = filter.excludedStudios.includes(id);
      const isActive = filter.studios.includes(id);
      if (isExcluded) {
        onChange({ ...filter, excludedStudios: filter.excludedStudios.filter((x) => x !== id) });
      } else if (isActive) {
        onChange({
          ...filter,
          studios: filter.studios.filter((x) => x !== id),
          excludedStudios: [...filter.excludedStudios, id],
        });
      } else {
        onChange({ ...filter, studios: [...filter.studios, id] });
      }
    } else if (type === 'staff') {
      const isExcluded = filter.excludedStaff.includes(id);
      const isActive = filter.staff.includes(id);
      if (isExcluded) {
        onChange({ ...filter, excludedStaff: filter.excludedStaff.filter((x) => x !== id) });
      } else if (isActive) {
        onChange({
          ...filter,
          staff: filter.staff.filter((x) => x !== id),
          excludedStaff: [...filter.excludedStaff, id],
        });
      } else {
        onChange({ ...filter, staff: [...filter.staff, id] });
      }
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 bg-black/75 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 backdrop-blur-md' : 'opacity-0 backdrop-blur-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`glass-card w-full max-w-2xl p-6 space-y-5 max-h-[85vh] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[var(--color-border-glass)] pb-3 flex-shrink-0">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--color-text-primary)]">
              {t('filter.explorePortal', 'Explore Database Items')}
            </h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              {t('filter.explorePortalDesc', 'Browse and select tags, studios, or staff members to filter your feed.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[var(--color-text-secondary)] hover:text-white flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
          >
            ×
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 border-b border-[var(--color-border-glass)]/30 pb-3 flex-shrink-0">
          {(['tags', 'studios', 'staff'] as const).map((tab) => {
            const label = tab === 'tags'
              ? t('filter.tagsLabel', 'Tags')
              : tab === 'studios'
              ? t('filter.studiosLabel', 'Studios')
              : t('staff', 'Staff');
            const isActive = activeTab === tab;
            let count = 0;
            if (tab === 'tags') count = tags.length;
            else if (tab === 'studios') count = studios.length;
            else count = staff.length;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setSearch('');
                }}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/30'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/5 border border-transparent'
                }`}
              >
                {label}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-[var(--color-text-tertiary)] font-normal">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search bar inside portal */}
        <div className="relative w-full flex-shrink-0">
          <input
            type="text"
            placeholder={
              activeTab === 'tags'
                ? t('filter.searchTags', 'Search tags...')
                : activeTab === 'studios'
                ? t('filter.searchStudios', 'Search studios...')
                : t('filter.searchStaff', 'Search staff...')
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full py-2.5 pl-10 pr-10 text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--color-text-tertiary)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-2">
            {filtered.map((item) => {
              let id: number;
              let label: string;
              let isActive = false;
              let isExcluded = false;
              let image: string | null = null;
              let category: string | null = null;

              if (activeTab === 'tags') {
                const tag = item as Tag & { category?: string | null };
                id = tag.tag_id;
                label = preferUkTitles ? (tag.name_uk || tag.name_en) : tag.name_en;
                isActive = filter.tags.includes(id);
                isExcluded = filter.excludedTags.includes(id);
                category = tag.category || null;
              } else if (activeTab === 'studios') {
                const studio = item as Studio;
                id = studio.studio_id;
                label = studio.name;
                isActive = filter.studios.includes(id);
                isExcluded = filter.excludedStudios.includes(id);
              } else {
                const person = item as Staff;
                id = person.staff_id;
                label = person.full_name;
                isActive = filter.staff.includes(id);
                isExcluded = filter.excludedStaff.includes(id);
                image = person.image_large;
              }

              let rowClass =
                'flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 cursor-pointer select-none text-sm ';
              if (isExcluded) {
                rowClass += 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/15';
              } else if (isActive) {
                rowClass +=
                  'bg-[var(--color-accent-primary)]/15 text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/20 hover:bg-[var(--color-accent-primary)]/20';
              } else {
                rowClass +=
                  'bg-[var(--color-bg-input)]/20 text-[var(--color-text-secondary)] border-[var(--color-border-glass)] hover:border-[var(--color-border-glass-hover)] hover:text-[var(--color-text-primary)]';
              }

              return (
                <div key={id} onClick={() => handleItemToggle(activeTab, id)} className={rowClass}>
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {activeTab === 'staff' && (
                      image ? (
                        <img
                          src={image}
                          alt={label}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-[var(--color-border-glass)]"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border-glass)] flex items-center justify-center text-xs flex-shrink-0">
                          👤
                        </div>
                      )
                    )}
                    <span className="font-semibold text-[var(--color-text-primary)] break-words">{label}</span>
                    {category && (
                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/10 whitespace-nowrap">
                        {category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {isActive && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/30">
                        + Include
                      </span>
                    )}
                    {isExcluded && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 line-through">
                        − Exclude
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-xs text-[var(--color-text-muted)] italic">
                {t('common.noResults', 'No items found matching your search.')}
              </div>
            )}
          </div>
        </div>

        {/* Footer info/controls */}
        <div className="flex justify-between items-center border-t border-[var(--color-border-glass)] pt-3 flex-shrink-0 text-[11px] text-[var(--color-text-tertiary)]">
          <div>
            💡 {t('filter.portalTip', 'Click item to Include (+) → Exclude (−) → Remove.')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--color-accent-primary)] text-white hover:bg-[var(--color-accent-primary-hover)] transition-all font-semibold cursor-pointer"
          >
            {t('common.apply', 'Apply')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
