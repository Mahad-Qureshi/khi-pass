'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { Database } from '@/types/database.types';
import { saveDrop, saveExperience, saveVenue, type MerchantResult } from '../actions';
import { dropInput, experienceInput, fromKarachiISOString, venueInput } from '../schema';
import type { z } from 'zod';

const Form = styled('form')(({ theme }) => ({
  display: 'grid', gap: theme.spacing(2), maxWidth: 760, width: '100%',
}));
const Fields = styled('div')(({ theme }) => ({
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
}));
const Span = styled('div')({ gridColumn: '1 / -1', minWidth: 0 });

type Option = { id: string; name: string };
type Venue = Database['public']['Tables']['venues']['Row'];
type Experience = Database['public']['Tables']['experiences']['Row'];
type Drop = Database['public']['Tables']['drops']['Row'];
type ExperienceOption = { id: string; title: string; venue_id: string };

function useSubmission(merchantId: string, kind: 'venues' | 'experiences' | 'drops') {
  const router = useRouter();
  const [error, setError] = useState('');
  async function finish(result: MerchantResult) {
    if ('error' in result) { setError(result.error); return; }
    setError('');
    if (result.id) router.push(`/merchant/${merchantId}/${kind}/${result.id}`);
    router.refresh();
  }
  return { error, setError, finish };
}

export function VenueEditor({ merchantId, record, areas }: { merchantId: string; record?: Venue; areas: Option[] }) {
  type Input = z.input<typeof venueInput>;
  type Output = z.output<typeof venueInput>;
  const { error, finish } = useSubmission(merchantId, 'venues');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Input, unknown, Output>({
    resolver: zodResolver(venueInput),
    defaultValues: { merchantId, id: record?.id, name: record?.name ?? '', slug: record?.slug ?? '',
      areaId: record?.area_id ?? areas[0]?.id ?? '', address: record?.address ?? '',
      phone: record?.phone ?? '', googleMapsUrl: record?.google_maps_url ?? '' },
  });
  return <Form noValidate aria-busy={isSubmitting} onSubmit={handleSubmit(async values => finish(await saveVenue(values)))}>
    <Typography variant="h5" component="h2">{record ? 'Edit venue' : 'Create venue'}</Typography>
    <Typography color="text.secondary">Changes to published venues require moderation before becoming public.</Typography>
    {error && <Alert severity="error" role="alert">{error}</Alert>}
    <TextField label="Venue name" required disabled={isSubmitting} {...register('name')} error={!!errors.name} helperText={errors.name?.message} />
    <TextField label="URL slug" required disabled={isSubmitting} {...register('slug')} error={!!errors.slug} helperText={errors.slug?.message} />
    <TextField select label="Karachi area" required disabled={isSubmitting} defaultValue={record?.area_id ?? areas[0]?.id ?? ''}
      {...register('areaId')} error={!!errors.areaId} helperText={errors.areaId?.message}>
      {areas.map(x => <MenuItem value={x.id} key={x.id}>{x.name}</MenuItem>)}
    </TextField>
    <TextField label="Address" multiline minRows={2} required disabled={isSubmitting} {...register('address')}
      error={!!errors.address} helperText={errors.address?.message} />
    <TextField label="Phone (optional)" disabled={isSubmitting} {...register('phone')} error={!!errors.phone} helperText={errors.phone?.message} />
    <TextField label="Google Maps URL (optional)" disabled={isSubmitting} {...register('googleMapsUrl')}
      error={!!errors.googleMapsUrl} helperText={errors.googleMapsUrl?.message} />
    <Button variant="contained" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save venue'}</Button>
  </Form>;
}

export function ExperienceEditor({ merchantId, record, venues, categories }: {
  merchantId: string; record?: Experience; venues: Option[]; categories: Option[];
}) {
  type Input = z.input<typeof experienceInput>;
  type Output = z.output<typeof experienceInput>;
  const { error, finish } = useSubmission(merchantId, 'experiences');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Input, unknown, Output>({
    resolver: zodResolver(experienceInput), defaultValues: {
      merchantId, id: record?.id, title: record?.title ?? '', slug: record?.slug ?? '', description: record?.description ?? '',
      venueId: record?.venue_id ?? venues[0]?.id ?? '', categoryId: record?.category_id ?? categories[0]?.id ?? '',
      minPrice: String(record?.min_price ?? 0), maxPrice: record?.max_price == null ? '' : String(record.max_price),
      durationMinutes: record?.duration_minutes ?? '', minGroupSize: record?.min_group_size ?? 1,
      maxGroupSize: record?.max_group_size ?? '', setting: (record?.setting as Output['setting']) ?? 'indoor',
      bookingRequired: record?.booking_required ?? false,
    },
  });
  return <Form noValidate aria-busy={isSubmitting} onSubmit={handleSubmit(async values => finish(await saveExperience(values)))}>
    <Typography variant="h5" component="h2">{record ? 'Edit experience' : 'Create experience'}</Typography>
    <Typography color="text.secondary">Price in PKR. Public visibility requires venue approval and experience moderation.</Typography>
    {error && <Alert severity="error" role="alert">{error}</Alert>}
    <TextField label="Experience title" required disabled={isSubmitting} {...register('title')} error={!!errors.title} helperText={errors.title?.message} />
    <TextField label="URL slug" required disabled={isSubmitting} {...register('slug')} error={!!errors.slug} helperText={errors.slug?.message} />
    <TextField select label="Venue" required disabled={isSubmitting} defaultValue={record?.venue_id ?? venues[0]?.id ?? ''}
      {...register('venueId')} error={!!errors.venueId} helperText={errors.venueId?.message}>
      {venues.map(x => <MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}
    </TextField>
    <TextField select label="Category" required disabled={isSubmitting} defaultValue={record?.category_id ?? categories[0]?.id ?? ''}
      {...register('categoryId')} error={!!errors.categoryId} helperText={errors.categoryId?.message}>
      {categories.map(x => <MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}
    </TextField>
    <TextField label="Description" multiline minRows={3} required disabled={isSubmitting}
      {...register('description')} error={!!errors.description} helperText={errors.description?.message} />
    <Fields>
      <TextField label="Minimum price (PKR)" required slotProps={{ htmlInput: { inputMode: 'decimal' } }} disabled={isSubmitting}
        {...register('minPrice')} error={!!errors.minPrice} helperText={errors.minPrice?.message} />
      <TextField label="Maximum price (PKR)" slotProps={{ htmlInput: { inputMode: 'decimal' } }} disabled={isSubmitting}
        {...register('maxPrice')} error={!!errors.maxPrice} helperText={errors.maxPrice?.message} />
      <TextField type="number" label="Duration (minutes)" disabled={isSubmitting}
        {...register('durationMinutes')} error={!!errors.durationMinutes} helperText={errors.durationMinutes?.message} />
      <TextField type="number" label="Minimum group size" required disabled={isSubmitting}
        {...register('minGroupSize')} error={!!errors.minGroupSize} helperText={errors.minGroupSize?.message} />
      <TextField type="number" label="Maximum group size" disabled={isSubmitting}
        {...register('maxGroupSize')} error={!!errors.maxGroupSize} helperText={errors.maxGroupSize?.message} />
      <TextField select label="Setting" disabled={isSubmitting} defaultValue={record?.setting ?? 'indoor'}
        {...register('setting')} error={!!errors.setting} helperText={errors.setting?.message}>
        <MenuItem value="indoor">Indoor</MenuItem><MenuItem value="outdoor">Outdoor</MenuItem><MenuItem value="mixed">Mixed</MenuItem>
      </TextField>
      <Span><FormControlLabel control={<Checkbox defaultChecked={record?.booking_required ?? false} disabled={isSubmitting} {...register('bookingRequired')} />}
        label="Booking required" /></Span>
    </Fields>
    <Button variant="contained" type="submit" disabled={isSubmitting || !venues.length}>{isSubmitting ? 'Saving…' : 'Save experience'}</Button>
  </Form>;
}

export function DropEditor({ merchantId, record, venues, experiences }: {
  merchantId: string; record?: Drop; venues: Option[]; experiences: ExperienceOption[];
}) {
  type Input = z.input<typeof dropInput>;
  type Output = z.output<typeof dropInput>;
  const { error, finish } = useSubmission(merchantId, 'drops');
  const { register, handleSubmit, control, getValues, setValue, formState: { errors, isSubmitting } } = useForm<Input, unknown, Output>({
    resolver: zodResolver(dropInput), defaultValues: {
      merchantId, id: record?.id, venueId: record?.venue_id ?? venues[0]?.id ?? '',
      experienceId: record?.experience_id ?? '', title: record?.title ?? '', slug: record?.slug ?? '',
      description: record?.description ?? '', terms: record?.terms ?? '',
      originalPrice: record?.original_price == null ? '' : String(record.original_price),
      dropPrice: String(record?.drop_price ?? 0),
      startsAt: record ? fromKarachiISOString(record.starts_at) : '',
      endsAt: record ? fromKarachiISOString(record.ends_at) : '',
      claimLimit: record?.claim_limit ?? 1, perUserLimit: record?.per_user_limit ?? 1,
    },
  });
  const selectedVenueId = useWatch({ control, name: 'venueId' });
  useEffect(() => {
    const selectedExperience = getValues('experienceId');
    if (selectedExperience && !experiences.some(x => x.id === selectedExperience && x.venue_id === selectedVenueId)) {
      setValue('experienceId', '');
    }
  }, [selectedVenueId, experiences, getValues, setValue]);
  return <Form noValidate aria-busy={isSubmitting} onSubmit={handleSubmit(async values => finish(await saveDrop(values)))}>
    <Typography variant="h5" component="h2">{record ? 'Edit PASS Drop' : 'Create PASS Drop'}</Typography>
    <Typography color="text.secondary">Dates use Karachi time (UTC+05:00). Stock and per-user limits cannot be changed after creation.</Typography>
    {error && <Alert severity="error" role="alert">{error}</Alert>}
    <TextField label="Drop title" required disabled={isSubmitting} {...register('title')} error={!!errors.title} helperText={errors.title?.message} />
    <TextField label="URL slug" required disabled={isSubmitting} {...register('slug')} error={!!errors.slug} helperText={errors.slug?.message} />
    <TextField select label="Venue" required disabled={isSubmitting} defaultValue={record?.venue_id ?? venues[0]?.id ?? ''}
      {...register('venueId')} error={!!errors.venueId} helperText={errors.venueId?.message}>
      {venues.map(x => <MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}
    </TextField>
    <TextField select label="Linked experience (optional)" defaultValue={record?.experience_id ?? ''} disabled={isSubmitting}
      {...register('experienceId')} error={!!errors.experienceId} helperText={errors.experienceId?.message}>
      <MenuItem value="">No linked experience</MenuItem>
      {experiences.filter(x => x.venue_id === selectedVenueId).map(x => <MenuItem key={x.id} value={x.id}>{x.title}</MenuItem>)}
    </TextField>
    <TextField label="Description" multiline minRows={3} required disabled={isSubmitting}
      {...register('description')} error={!!errors.description} helperText={errors.description?.message} />
    <TextField label="Terms and conditions" multiline minRows={3} required disabled={isSubmitting}
      {...register('terms')} error={!!errors.terms} helperText={errors.terms?.message} />
    <Fields>
      <TextField label="Original price (PKR)" slotProps={{ htmlInput: { inputMode: 'decimal' } }} disabled={isSubmitting}
        {...register('originalPrice')} error={!!errors.originalPrice} helperText={errors.originalPrice?.message} />
      <TextField label="PASS price (PKR)" required slotProps={{ htmlInput: { inputMode: 'decimal' } }} disabled={isSubmitting}
        {...register('dropPrice')} error={!!errors.dropPrice} helperText={errors.dropPrice?.message} />
      <TextField label="Starts (Karachi)" type="datetime-local" required disabled={isSubmitting}
        slotProps={{ inputLabel: { shrink: true } }} {...register('startsAt')} error={!!errors.startsAt} helperText={errors.startsAt?.message} />
      <TextField label="Ends (Karachi)" type="datetime-local" required disabled={isSubmitting}
        slotProps={{ inputLabel: { shrink: true } }} {...register('endsAt')} error={!!errors.endsAt} helperText={errors.endsAt?.message} />
      <TextField label="Total available claims" type="number" required disabled={isSubmitting} slotProps={{ input: { readOnly: !!record } }}
        {...register('claimLimit')} error={!!errors.claimLimit} helperText={record ? 'Locked after creation.' : errors.claimLimit?.message} />
      <TextField label="Limit per user" type="number" required disabled={isSubmitting} slotProps={{ input: { readOnly: !!record } }}
        {...register('perUserLimit')} error={!!errors.perUserLimit} helperText={record ? 'Locked after creation.' : errors.perUserLimit?.message} />
    </Fields>
    <Button variant="contained" type="submit" disabled={isSubmitting || !venues.length}>{isSubmitting ? 'Saving…' : 'Save PASS Drop'}</Button>
  </Form>;
}
