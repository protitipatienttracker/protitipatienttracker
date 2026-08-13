import { vi } from 'vitest'

// Stub the supabase client so db.ts can be imported without real env vars
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
    channel: vi.fn(),
  },
  // re-export all types as-is (they're just interfaces, no runtime value needed)
}))
