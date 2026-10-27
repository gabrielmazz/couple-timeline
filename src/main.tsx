import '@mantine/core/styles.css'
import 'mantine-contextmenu/styles.css'
import '@mantine/carousel/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/dropzone/styles.css'
import '@mantine/notifications/styles.css'
import 'dayjs/locale/pt-br'

import {
  Badge,
  Button,
  MantineProvider,
  PasswordInput,
  SegmentedControl,
  Select,
  TagsInput,
  TextInput,
  Textarea,
  createTheme,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { Dropzone } from '@mantine/dropzone'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { ContextMenuProvider } from 'mantine-contextmenu'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './components/auth/AuthProvider'
import './index.css'

const routerBasename = import.meta.env.BASE_URL

const theme = createTheme({
  primaryColor: 'pink',
  defaultRadius: 8,
  fontFamily: 'var(--app-font-family)',
  headings: {
    fontFamily: 'var(--app-heading-font)',
    fontWeight: '400',
  },
  components: {
    Badge: Badge.extend({
      styles: {
        label: {
          display: 'inline-flex',
          alignItems: 'center',
          lineHeight: 1,
        },
      },
    }),
    Button: Button.extend({
      styles: {
        label: {
          lineHeight: 1,
          textBoxTrim: 'none',
        },
      },
    }),
    DateInput: DateInput.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
    Dropzone: Dropzone.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
    PasswordInput: PasswordInput.extend({
      defaultProps: {
        radius: 'sm',
        visibilityToggleButtonProps: { 'aria-label': 'Mostrar ou ocultar senha' },
      },
    }),
    SegmentedControl: SegmentedControl.extend({
      defaultProps: {
        radius: 'sm',
      },
      styles: {
        label: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        },
        innerLabel: {
          lineHeight: 1,
        },
      },
    }),
    Select: Select.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
    TagsInput: TagsInput.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
    Textarea: Textarea.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
    TextInput: TextInput.extend({
      defaultProps: {
        radius: 'sm',
      },
    }),
  },
  colors: {
    pink: [
      '#fff0f8', '#f7dce9', '#eebed7', '#e4a0c4', '#d782b0',
      '#c7669c', '#b34e88', '#923a6e', '#752e58', '#592343',
    ],
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ContextMenuProvider>
        <Notifications position="top-right" zIndex={5000} />
        <ModalsProvider>
          <BrowserRouter basename={routerBasename}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ModalsProvider>
      </ContextMenuProvider>
    </MantineProvider>
  </StrictMode>,
)
