import { sortToursByPublishedAt } from './cms/legacy-adapter.mjs';

const previewLimit = 3;

export function buildHomeTourGroups(latest, catalogue) {
  const groups = [{ id: 'featured', path: 'featured', tours: latest.slice(0, previewLimit) }];
  const used = new Set(groups[0].tours.map(tour => tour.id));
  const ordered = sortToursByPublishedAt(catalogue);
  const categories = [
    { id: 'canada', path: 'destination/geo-ca', includes: tour => tour.tour_terms?.destinationScope?.includes('geo-ca') },
    { id: 'cruises', path: 'style/cruises', includes: tour => tour.tour_terms?.styles?.some(term => term.slug === 'cruises') },
  ];

  for (const { id, path, includes } of categories) {
    const matches = ordered.filter(includes);
    if (!matches.length) continue;
    // Surface more tours where possible, while still filling the preview for smaller categories.
    const tours = [...matches.filter(tour => !used.has(tour.id)), ...matches.filter(tour => used.has(tour.id))].slice(0, previewLimit);
    tours.forEach(tour => used.add(tour.id));
    groups.push({ id, path, tours });
  }
  return groups.filter(group => group.tours.length > 0);
}
