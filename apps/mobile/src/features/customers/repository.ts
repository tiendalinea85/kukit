import { getDb } from '../../core/db/database';
import { nextCodeFor, softDelete, writeWithOutbox } from '../../core/db/repo';
import type { Client } from '../../core/domain/types';
import { newId, nowIso } from '../../core/utils/id';

export async function listClients(): Promise<Client[]> {
  const db = await getDb();
  return db.getAllAsync<Client>(
    `SELECT * FROM clients WHERE deleted = 0 ORDER BY name COLLATE NOCASE`
  );
}

export async function getClient(id: string): Promise<Client | null> {
  const db = await getDb();
  return db.getFirstAsync<Client>('SELECT * FROM clients WHERE id = ?', id);
}

export interface ClientForm {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export async function saveClient(form: ClientForm): Promise<Client> {
  const db = await getDb();
  const existing = form.id ? await getClient(form.id) : null;

  const now = nowIso();
  const row: Client = {
    id: form.id ?? newId(),
    code: existing?.code ?? '',
    name: form.name.trim(),
    phone: form.phone,
    email: form.email,
    address: form.address,
    notes: form.notes,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (!row.code) {
    row.code = await nextCodeFor(db, 'clients', 'CLI');
  }

  await writeWithOutbox(db, {
    table: 'clients',
    entityType: 'client',
    operation: existing ? 'UPDATE' : 'INSERT',
    row: row as unknown as Record<string, unknown>,
    before: existing,
  });

  return row;
}

export async function deleteClient(id: string): Promise<void> {
  const db = await getDb();
  await softDelete(db, 'clients', 'client', id);
}

export const defaultClientForm = (): ClientForm => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
});
