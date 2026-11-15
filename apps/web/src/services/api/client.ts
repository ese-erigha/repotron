import { API_ORIGIN } from '../../config/public-config'
import { HttpClient } from './http-client'

let httpClient: HttpClient | null = null

/** Returns the one HTTP client of the app. The first call builds it. */
export function getHttpClient(): HttpClient {
  if (httpClient === null) httpClient = new HttpClient(API_ORIGIN)
  return httpClient
}
