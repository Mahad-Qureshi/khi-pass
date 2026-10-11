'use client';
import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';
import Link from '@/components/common/Link';
import { budgetOptions, discoverHref, filterKeys, groupOptions, normalizeFilters, whenOptions, type FilterKey, type ReferenceData } from '../filters';

const Form = styled('form')(({ theme }) => ({
  display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing(2),
  padding: theme.spacing(2), borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper,
  [theme.breakpoints.up('md')]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', padding: theme.spacing(3) },
}));
const Field = styled('label')(({ theme }) => ({
  ...theme.typography.body2, display: 'grid', gap: theme.spacing(0.5), fontWeight: 700,
  color: theme.palette.text.primary,
}));
const Select = styled('select')(({ theme }) => ({
  ...theme.typography.body1, width: '100%', minWidth: 0, minHeight: theme.spacing(5.5),
  padding: theme.spacing(1), borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper,
  color: theme.palette.text.primary,
  '&:focus-visible': { outline: `2px solid ${theme.palette.secondary.main}`, outlineOffset: theme.spacing(0.5) },
}));
const Actions = styled('div')(({ theme }) => ({
  gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing(1),
}));

export function DiscoveryFilters({ refs, showCta = false }: { refs: ReferenceData; showCta?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const current = search.toString();
  const filters = useMemo(() => {
    const params = new URLSearchParams(current);
    const raw = Object.fromEntries(filterKeys.map((key) => {
      const values = params.getAll(key);
      return [key, values.length === 1 ? values[0] : values.length ? values : undefined];
    }));
    return normalizeFilters(raw, refs);
  }, [current, refs]);

  useEffect(() => {
    const params = new URLSearchParams(current);
    let changed = false;
    for (const key of filterKeys) if (params.has(key) && (params.getAll(key).length !== 1 || params.get(key) !== filters[key])) {
      params.delete(key);
      changed = true;
    }
    if (changed) router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
  }, [current, filters, pathname, router]);

  function update(key: FilterKey, value: string) {
    const params = new URLSearchParams(current);
    if (value) params.set(key, value); else params.delete(key);
    router.push(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
  }

  const fields = [
    { key: 'when', label: 'When', options: whenOptions.map(({ value, label }) => ({ value, label })) },
    { key: 'area', label: 'Area', options: refs.areas.map(({ slug, name }) => ({ value: slug, label: name })) },
    { key: 'budget', label: 'Budget', options: budgetOptions.map(({ value, label }) => ({ value, label })) },
    { key: 'vibe', label: 'Vibe', options: refs.vibes.map(({ slug, name }) => ({ value: slug, label: name })) },
    { key: 'group', label: 'Group type', options: groupOptions.map(({ value, label }) => ({ value, label })) },
    { key: 'category', label: 'Category', options: refs.categories.map(({ slug, name }) => ({ value: slug, label: name })) },
  ] as const;

  return <Form role="search" onSubmit={(event) => { event.preventDefault(); router.push(discoverHref(filters)); }}>
    {fields.map(({ key, label, options }) => <Field key={key}>
      {label}
      <Select value={filters[key]} onChange={(event) => update(key, event.target.value)} aria-label={label}>
        <option value="">Any {label.toLowerCase()}</option>
        {options.map(({ value, label: optionLabel }) => <option key={value} value={value}>{optionLabel}</option>)}
      </Select>
    </Field>)}
    <Actions>
      {showCta && <Button type="submit" variant="contained">Explore Karachi</Button>}
      {!showCta && <Button component={Link} href="/discover" variant="text">Clear filters</Button>}
    </Actions>
  </Form>;
}
