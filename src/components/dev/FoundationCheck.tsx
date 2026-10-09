'use client';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

import Link from '@/components/common/Link';

const Root = styled('main')(({ theme }) => ({
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.default,
}));

const Card = styled('section')(({ theme }) => ({
    width: '100%',
    maxWidth: 520,
    padding: theme.spacing(4),
    borderRadius:
        typeof theme.shape.borderRadius === 'number'
            ? theme.shape.borderRadius * 2
            : theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
}));

const Actions = styled('div')(({ theme }) => ({
    display: 'flex',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(3),
    flexWrap: 'wrap',
}));

export function FoundationCheck() {
    return (
        <Root>
            <Card>
                <Typography variant="h3" component="h1">
                    KHI PASS
                </Typography>

                <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                >
                    Karachi mein aaj kya karein?
                </Typography>

                <Actions>
                    <Button variant="contained">
                        Discover
                    </Button>

                    <Button
                        component={Link}
                        href="/drops"
                        variant="outlined"
                    >
                        PASS Drops
                    </Button>
                </Actions>
            </Card>
        </Root>
    );
}