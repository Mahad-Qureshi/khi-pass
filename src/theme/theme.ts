'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    cssVariables: true,

    palette: {
        mode: 'light',

        primary: {
            main: '#111827',
            contrastText: '#FFFFFF',
        },

        secondary: {
            main: '#6D5DFB',
            contrastText: '#FFFFFF',
        },

        background: {
            default: '#F8F8F8',
            paper: '#FFFFFF',
        },

        text: {
            primary: '#111827',
            secondary: '#6B7280',
        },

        divider: '#E5E7EB',
    },

    typography: {
        fontFamily: 'var(--font-inter)',

        h1: {
            fontWeight: 700,
            letterSpacing: '-0.04em',
        },

        h2: {
            fontWeight: 700,
            letterSpacing: '-0.03em',
        },

        h3: {
            fontWeight: 700,
            letterSpacing: '-0.02em',
        },

        button: {
            fontWeight: 600,
            textTransform: 'none',
        },
    },

    shape: {
        borderRadius: 12,
    },

    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },

            styleOverrides: {
                root: {
                    minHeight: 44,
                    borderRadius: 12,
                    paddingInline: 20,
                },
            },
        },

        MuiTextField: {
            defaultProps: {
                size: 'small',
            },
        },

        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: 'none',
                    border: '1px solid',
                    borderColor: '#E5E7EB',
                },
            },
        },
    },
});