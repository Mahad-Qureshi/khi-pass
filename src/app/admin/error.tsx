'use client';

import { Alert, Button, Stack } from '@mui/material';

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return <Stack spacing={2}><Alert severity="error">Administration is temporarily unavailable.</Alert>
    <Button onClick={reset}>Try again</Button></Stack>;
}
