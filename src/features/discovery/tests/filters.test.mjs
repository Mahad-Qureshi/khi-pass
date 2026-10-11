import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFilters, filterQuery, discoverHref } from '../filters.ts';
import { selectedWindow, matchesWindow } from '../time.ts';

const refs = {
  areas: [{ id: 'a', slug: 'clifton', name: 'Clifton' }],
  categories: [{ id: 'c', slug: 'food-drink', name: 'Food & Drink' }],
  vibes: [{ id: 'v', slug: 'date-night', name: 'Date Night' }],
};

test('valid filters survive URL serialization and invalid values normalize safely', () => {
  const filters = normalizeFilters({ when: 'weekend', area: 'clifton', budget: 'under-2000', vibe: 'date-night', group: 'couple', category: 'food-drink' }, refs);
  assert.equal(discoverHref(filters), '/discover?when=weekend&area=clifton&budget=under-2000&vibe=date-night&group=couple&category=food-drink');
  assert.equal(filterQuery(filters), new URLSearchParams(discoverHref(filters).split('?')[1]).toString());
  assert.deepEqual(normalizeFilters({ when: ['tonight', 'tomorrow'], area: '../clifton', budget: 'million', group: 'crowd' }, refs),
    { when: '', area: '', budget: '', vibe: '', group: '', category: '' });
});

test('Karachi time windows and weekly schedules use local dates', () => {
  const friday = new Date('2026-10-09T19:30:00Z'); // Saturday 00:30 in Karachi.
  const weekend = selectedWindow('weekend', friday);
  assert.equal(new Date(weekend.start).toISOString(), '2026-10-09T19:30:00.000Z');
  assert.equal(new Date(weekend.end).toISOString(), '2026-10-11T19:00:00.000Z');
  assert.equal(matchesWindow({ starts_at: null, ends_at: null, schedules: [
    { weekday: 6, opens_at: '18:00:00', closes_at: '23:00:00', valid_from: null, valid_until: null },
  ] }, weekend), true);
  assert.equal(matchesWindow({ starts_at: null, ends_at: null, schedules: [
    { weekday: 1, opens_at: '18:00:00', closes_at: '23:00:00', valid_from: null, valid_until: null },
  ] }, weekend), false);
});
