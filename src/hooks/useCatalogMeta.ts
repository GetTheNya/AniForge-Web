/**
 * useCatalogMeta — hook to fetch genre, tag, studio, staff lists
 * from the local SQLite catalog for filter panel population.
 */

import { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import type { Genre, Tag, Studio, Staff } from '../types/anime';

interface CatalogMeta {
  genres: Genre[];
  tags: Tag[];
  studios: Studio[];
  staff: Staff[];
  isLoaded: boolean;
}

export function useCatalogMeta(): CatalogMeta {
  const { db, status, queryObjects } = useDatabase();
  const [meta, setMeta] = useState<CatalogMeta>({
    genres: [],
    tags: [],
    studios: [],
    staff: [],
    isLoaded: false,
  });

  useEffect(() => {
    if (!db || status !== 'ready') return;

    try {
      const genres = queryObjects<Genre>(
        `SELECT g.slug, g.name_en, g.name_uk
         FROM genres g
         LEFT JOIN anime_genres ag ON g.slug = ag.genre_slug
         GROUP BY g.slug
         ORDER BY COUNT(ag.anilist_id) DESC, g.name_en ASC`,
      );

      const tags = queryObjects<Tag & { category: string | null }>(
        `SELECT t.tag_id, t.name_en, t.name_uk, t.category
         FROM tags t
         LEFT JOIN anime_tags at2 ON t.tag_id = at2.tag_id
         GROUP BY t.tag_id
         ORDER BY COUNT(at2.anilist_id) DESC, t.name_en ASC`,
      );

      const studios = queryObjects<Studio>(
        `SELECT s.studio_id, s.name
         FROM studios s
         LEFT JOIN anime_studios ast ON s.studio_id = ast.studio_id
         GROUP BY s.studio_id
         ORDER BY COUNT(ast.anilist_id) DESC, s.name ASC`,
      );

      const staff = queryObjects<Staff>(
        `SELECT s.staff_id, s.full_name, s.image_large
         FROM staff s
         LEFT JOIN anime_staff ast ON s.staff_id = ast.staff_id
         GROUP BY s.staff_id
         ORDER BY COUNT(ast.anilist_id) DESC, s.full_name ASC
         LIMIT 500`,
      );

      setMeta({ genres, tags, studios, staff, isLoaded: true });
    } catch (e) {
      console.error('[useCatalogMeta] Failed to load catalog metadata:', e);
    }
  }, [db, status, queryObjects]);

  return meta;
}
