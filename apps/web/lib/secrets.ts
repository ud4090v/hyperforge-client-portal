/**
 * Runtime secret fetcher — shells out to get-secret.sh (Infisical).
 * Server-side only. Never call from browser code.
 */
import { execSync } from 'child_process'

const GET_SECRET_SCRIPT = '/root/.openclaw/workspace/.credentials/get-secret.sh'

export function getSecret(key: string): string {
  try {
    const value = execSync(`${GET_SECRET_SCRIPT} ${key}`, {
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim()
    if (!value) {
      throw new Error(`Secret ${key} is empty`)
    }
    return value
  } catch (err) {
    throw new Error(`Failed to fetch secret ${key}: ${String(err)}`)
  }
}

export function getSupabaseUrl(): string {
  return getSecret('SUPABASE_URL')
}

export function getSupabaseServiceKey(): string {
  return getSecret('SUPABASE_SERVICE_KEY')
}

export function getOpenAIApiKey(): string {
  return getSecret('OPENAI_API_KEY')
}

export function getPlaneApiKey(): string {
  return getSecret('PLANE_API_KEY_NOVA')
}
