import { describe, it, expect } from 'vitest';
import { getDatabase, initDatabase } from '../src/db';
import { settings } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Settings API & DB', () => {
  it('initializes default whatsapp_platform setting as "web"', async () => {
    await initDatabase();
    const { db } = getDatabase();

    const [platformSetting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'whatsapp_platform'));

    expect(platformSetting).toBeDefined();
    expect(platformSetting.value).toBe('web');
  });

  it('can update whatsapp_platform to "app"', async () => {
    await initDatabase();
    const { db } = getDatabase();

    const now = new Date().toISOString();
    await db
      .update(settings)
      .set({ value: 'app', updated_at: now })
      .where(eq(settings.key, 'whatsapp_platform'));

    const [updated] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'whatsapp_platform'));

    expect(updated.value).toBe('app');

    // Restore to 'web'
    await db
      .update(settings)
      .set({ value: 'web', updated_at: now })
      .where(eq(settings.key, 'whatsapp_platform'));
  });
});
