'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Chip, MenuItem, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { addExperienceSchedule, removeExperienceSchedule, setExperienceVibe, type MerchantResult } from '../actions';

const Root = styled('section')(({ theme }) => ({ display: 'grid', gap: theme.spacing(2), marginBlock: theme.spacing(3), maxWidth: 760 }));
const Line = styled('div')(({ theme }) => ({
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing(1), minWidth: 0,
  '& > *': { maxWidth: '100%' },
}));
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Props = {
  merchantId: string; experienceId: string;
  schedules: { id: string; weekday: number; opens_at: string; closes_at: string }[];
  selectedVibes: string[]; vibes: { id: string; name: string }[];
};
export function ExperienceAvailability(props: Props) {
  const router = useRouter();
  const [weekday, setWeekday] = useState(0);
  const [opensAt, setOpensAt] = useState('10:00');
  const [closesAt, setClosesAt] = useState('20:00');
  const [vibeId, setVibeId] = useState(props.vibes[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = { merchantId: props.merchantId, experienceId: props.experienceId };
  async function change(action: () => Promise<MerchantResult>) {
    setBusy(true); setError('');
    try {
      const result = await action();
      if ('error' in result) setError(result.error);
      else router.refresh();
    } catch { setError('Unable to update experience.'); }
    finally { setBusy(false); }
  }
  return <Root aria-label="Experience availability and vibes">
    <Typography variant="h5" component="h2">Availability</Typography>
    <Typography color="text.secondary">Add weekly Karachi-time slots. For overnight hours, split into two days. Updates to published experiences require re-approval.</Typography>
    {error && <Alert severity="error" role="alert">{error}</Alert>}
    <Line>
      <TextField select label="Day" size="small" value={weekday} onChange={e => setWeekday(Number(e.target.value))}>
        {DAYS.map((x, i) => <MenuItem value={i} key={x}>{x}</MenuItem>)}
      </TextField>
      <TextField type="time" label="Opens" size="small" value={opensAt} onChange={e => setOpensAt(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField type="time" label="Closes" size="small" value={closesAt} onChange={e => setClosesAt(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <Button disabled={busy || closesAt <= opensAt} onClick={() => change(() => addExperienceSchedule({ ...base, weekday, opensAt, closesAt }))} variant="outlined">Add hours</Button>
    </Line>
    {props.schedules.length === 0 && <Alert severity="info">Add at least one schedule for time-based discovery.</Alert>}
    {props.schedules.map(x => <Line key={x.id}>
      <Typography>{DAYS[x.weekday]} · {x.opens_at.slice(0, 5)}–{x.closes_at.slice(0, 5)}</Typography>
      <Button size="small" color="error" disabled={busy} onClick={() => change(() => removeExperienceSchedule({ ...base, scheduleId: x.id }))}>Remove</Button>
    </Line>)}
    <Typography variant="h5" component="h2">Vibes</Typography>
    <Line>
      <TextField select size="small" label="Vibe" value={vibeId} onChange={e => setVibeId(e.target.value)} sx={{ minWidth: 180 }}>
        {props.vibes.map(x => <MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}
      </TextField>
      <Button disabled={busy || !vibeId} variant="outlined" onClick={() => change(() => setExperienceVibe({ ...base, vibeId }, true))}>Add vibe</Button>
    </Line>
    <Line>
      {props.selectedVibes.map(id => <Chip key={id} disabled={busy}
        label={props.vibes.find(v => v.id === id)?.name ?? 'Inactive vibe'}
        onDelete={() => change(() => setExperienceVibe({ ...base, vibeId: id }, false))} />)}
    </Line>
  </Root>;
}
