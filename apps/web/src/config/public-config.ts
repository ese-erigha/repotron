const GATEWAY_ORIGIN = 'https://repotron-staging-gateway.ese-erigha.workers.dev'

const STAGING_TURNSTILE_SITE_KEY = '0x4AAAAAAGBXtBG9qrWYoImQ'

/** The test key of Cloudflare. It passes on every host, so the widget works on localhost. */
const TEST_TURNSTILE_SITE_KEY = '1x00000000000000000000AA'

/** The dev server answers the API from fixtures on its own origin. */
export const API_ORIGIN = import.meta.env.DEV ? '' : GATEWAY_ORIGIN

export const TURNSTILE_SITE_KEY = import.meta.env.DEV ? TEST_TURNSTILE_SITE_KEY : STAGING_TURNSTILE_SITE_KEY
