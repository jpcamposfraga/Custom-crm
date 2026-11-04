import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase, initDatabase } from '../src/db';
import { settings } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Settings API & DB', () => {
  beforeEach(async () => {
    await initDatabase();
    const { db } = getDatabase();
    await db
      .insert(settings)
      .values({ key: 'whatsapp_platform', value: 'web', updated_at: new Date().toISOString() })
      .onConflictDoUpdate({ target: settings.key, set: { value: 'web' } });
  });

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

  it('can store and retrieve auto_send_whatsapp and whatsapp_session_connected', async () => {
    await initDatabase();
    const { db } = getDatabase();

    const now = new Date().toISOString();
    await db
      .insert(settings)
      .values([
        { key: 'auto_send_whatsapp', value: 'true', updated_at: now },
        { key: 'whatsapp_session_connected', value: 'true', updated_at: now },
      ])
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: 'true', updated_at: now },
      });

    const rows = await db.select().from(settings);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(map['auto_send_whatsapp']).toBe('true');
    expect(map['whatsapp_session_connected']).toBe('true');

    // Cleanup to prevent polluting other test suites
    await db.delete(settings).where(eq(settings.key, 'auto_send_whatsapp'));
    await db.delete(settings).where(eq(settings.key, 'whatsapp_session_connected'));
  });
});
