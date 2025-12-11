import posthog from "posthog-js"

// Only initialize PostHog if the key is configured and valid
// Set NEXT_PUBLIC_POSTHOG_ENABLED=false to disable during development
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const posthogEnabled = process.env.NEXT_PUBLIC_POSTHOG_ENABLED !== 'false';

// Determine UI host based on API host region
const isEU = posthogHost.includes('eu.');
const uiHost = isEU ? 'https://eu.posthog.com' : 'https://us.posthog.com';

// Accept phc_ (project) API keys only
if (posthogEnabled && posthogKey && posthogKey.startsWith('phc_')) {
  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      ui_host: uiHost,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      debug: process.env.NODE_ENV === 'development',
      // Disable automatic network requests during initialization
      autocapture: false,
      disable_session_recording: true,
      // Add timeout and retry logic
      loaded: function (ph) {
        if (process.env.NODE_ENV === 'development') {
          console.log('PostHog initialized successfully');
        }
      },
    });
  } catch (error) {
    // Silently fail PostHog initialization - analytics are non-critical
    if (process.env.NODE_ENV === 'development') {
      console.warn('PostHog initialization failed (non-critical):', error);
    }
  }
}
