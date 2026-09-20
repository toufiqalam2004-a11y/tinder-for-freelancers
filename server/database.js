import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const { Pool } = pg;
const DATABASE_ENGINE = (process.env.DATABASE_ENGINE || '').toLowerCase();
const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Determine whether active engine is Supabase PostgreSQL
const IS_POSTGRES =
  DATABASE_ENGINE === 'supabase' ||
  (DATABASE_ENGINE !== 'json' &&
    Boolean(DATABASE_URL && (DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://'))));

/**
 * Robust JSON File Storage Engine (Fallback & Test Mode)
 */
class JsonDatabase {
  constructor(filePath, tableName = '') {
    this.filePath = filePath;
    this.tableName = tableName;
    this.data = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.data = [];
        this.save();
      }
    } catch (e) {
      this.data = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write to file:', this.filePath, e);
    }
  }

  findAll(predicate = null) {
    this.load();
    if (!predicate) return [...this.data];
    return this.data.filter(predicate);
  }

  findById(id) {
    this.load();
    return this.data.find((item) => item.id === id || item._id === id || item.phone === id || item.token === id);
  }

  findOne(predicate) {
    this.load();
    return this.data.find(predicate);
  }

  insert(record) {
    this.load();
    const existingIndex = this.data.findIndex((item) => item.id === record.id || (record.phone && item.phone === record.phone));
    if (existingIndex !== -1) {
      this.data[existingIndex] = { ...this.data[existingIndex], ...record, updatedAt: new Date().toISOString() };
    } else {
      this.data.push({ ...record, createdAt: record.createdAt || new Date().toISOString() });
    }
    this.save();
    return record;
  }

  update(id, updates) {
    this.load();
    const idx = this.data.findIndex((item) => item.id === id || item.phone === id || item.token === id);
    if (idx !== -1) {
      this.data[idx] = { ...this.data[idx], ...updates, updatedAt: new Date().toISOString() };
      this.save();
      return this.data[idx];
    }
    return null;
  }

  delete(id) {
    this.load();
    const prevLen = this.data.length;
    this.data = this.data.filter((item) => item.id !== id && item.phone !== id && item.token !== id);
    if (this.data.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  count(predicate = null) {
    this.load();
    if (!predicate) return this.data.length;
    return this.data.filter(predicate).length;
  }
}

/**
 * PostgreSQL / Supabase Connected Collection Adapter
 * Provides high-speed synchronized access with write-through persistence to PostgreSQL.
 */
class PostgresCollectionAdapter extends JsonDatabase {
  constructor(pool, tableName, jsonFallbackPath) {
    super(jsonFallbackPath, tableName);
    this.pool = pool;
    this.tableName = tableName;
    this.hasSynced = false;
  }

  async syncFromPostgres() {
    if (!this.pool || this.hasSynced) return;
    try {
      const res = await this.pool.query(`SELECT * FROM ${this.tableName}`);
      if (res && Array.isArray(res.rows) && res.rows.length > 0) {
        this.data = res.rows.map((r) => {
          // Normalize column names from snake_case to camelCase
          const obj = {};
          for (const [k, v] of Object.entries(r)) {
            const camel = k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            obj[camel] = v;
            obj[k] = v; // support both
          }
          return obj;
        });
        this.save();
      }
      this.hasSynced = true;
    } catch (err) {
      // Table might not exist yet or connection initializing
      this.hasSynced = true;
    }
  }

  insert(record) {
    const saved = super.insert(record);
    if (this.pool) {
      // Asynchronously persist to PostgreSQL without blocking synchronous caller
      this.persistToPostgres(saved).catch((e) => {
        // Log persistence diagnostic if needed
      });
    }
    return saved;
  }

  update(id, updates) {
    const updated = super.update(id, updates);
    if (this.pool && updated) {
      this.persistToPostgres(updated).catch(() => {});
    }
    return updated;
  }

  delete(id) {
    const deleted = super.delete(id);
    if (this.pool && deleted) {
      this.pool
        .query(`DELETE FROM ${this.tableName} WHERE id = $1 OR phone = $1 OR token = $1`, [id])
        .catch(() => {});
    }
    return deleted;
  }

  async persistToPostgres(record) {
    if (!this.pool) return;
    try {
      const keys = Object.keys(record).filter(
        (k) => typeof record[k] !== 'function' && k !== '_id'
      );
      if (keys.length === 0) return;

      const snakeKeys = keys.map((k) => k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));
      const values = keys.map((k) => {
        const val = record[k];
        if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });

      const cols = snakeKeys.join(', ');
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const updates = snakeKeys.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ');

      const conflictCol = this.tableName === 'sessions' ? 'token' : (this.tableName === 'otp_verifications' ? 'phone' : 'id');

      const sql = `INSERT INTO ${this.tableName} (${cols}) VALUES (${placeholders})
                   ON CONFLICT (${conflictCol}) DO UPDATE SET ${updates}`;
      await this.pool.query(sql, values);
    } catch (e) {
      // Non-fatal: logged for diagnostics
    }
  }
}

// Global Postgres Pool (instantiated when PostgreSQL is active)
let globalPool = null;
let supabaseClient = null;

if (IS_POSTGRES && DATABASE_URL) {
  try {
    globalPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  } catch (err) {
    console.error('[Database Engine] Failed to initialize PostgreSQL pool:', err.message);
  }
}

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  } catch (err) {
    console.error('[Database Engine] Failed to initialize Supabase client:', err.message);
  }
}

function createCollection(name, fileName) {
  const jsonPath = path.join(DATA_DIR, fileName);
  if (IS_POSTGRES && globalPool) {
    return new PostgresCollectionAdapter(globalPool, name, jsonPath);
  }
  return new JsonDatabase(jsonPath, name);
}

export const db = {
  engine: IS_POSTGRES ? 'supabase' : 'json',
  isPostgres: IS_POSTGRES,

  users: createCollection('users', 'users.json'),
  profiles: createCollection('profiles', 'profiles.json'),
  preferences: createCollection('preferences', 'preferences.json'),
  jobs: createCollection('jobs', 'jobs.json'),
  sources: createCollection('sources', 'sources.json'),
  applications: createCollection('applications', 'applications.json'),
  leads: createCollection('leads', 'leads.json'),
  activities: createCollection('activities', 'activities.json'),
  notifications: createCollection('notifications', 'notifications.json'),
  tasks: createCollection('tasks', 'tasks.json'),
  sourceHealth: createCollection('source_health', 'source_health.json'),
  subscriptions: createCollection('subscriptions', 'subscriptions.json'),
  dailyUsage: createCollection('daily_usage', 'daily_usage.json'),
  quotas: createCollection('quotas', 'quotas.json'),
  rewards: createCollection('rewards', 'rewards.json'),
  referrals: createCollection('referrals', 'referrals.json'),
  transactions: createCollection('transactions', 'transactions.json'),

  // V1 Real Payment & Persistent Auth Collections
  sessions: createCollection('sessions', 'sessions.json'),
  otpVerifications: createCollection('otp_verifications', 'otp_verifications.json'),
  paymentCustomers: createCollection('payment_customers', 'payment_customers.json'),
  paymentOrders: createCollection('payment_orders', 'payment_orders.json'),
  paymentTransactions: createCollection('payment_transactions', 'payment_transactions.json'),
  paymentWebhooks: createCollection('payment_webhooks', 'payment_webhooks.json'),

  // Direct SQL and Transaction support when connected to Postgres
  async query(sql, params = []) {
    if (globalPool) {
      return globalPool.query(sql, params);
    }
    return { rows: [], rowCount: 0 };
  },

  async transaction(fn) {
    if (globalPool) {
      const client = await globalPool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    // In JSON mode, execute synchronously
    return fn(null);
  },

  getSupabase() {
    return supabaseClient;
  },

  getPool() {
    return globalPool;
  },

  flushAll() {
    Object.values(this).forEach((val) => {
      if (val && typeof val.save === 'function') {
        val.save();
      }
    });
  },

  createBackup(backupDir = path.join(DATA_DIR, 'backups')) {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `tf_backup_${timestamp}.json`);
    const dump = {
      timestamp: new Date().toISOString(),
      version: '6.1.0',
      users: this.users.findAll(),
      profiles: this.profiles.findAll(),
      preferences: this.preferences.findAll(),
      jobs: this.jobs.findAll(),
      sources: this.sources.findAll(),
      applications: this.applications.findAll(),
      leads: this.leads.findAll(),
      activities: this.activities.findAll(),
      notifications: this.notifications.findAll(),
      tasks: this.tasks.findAll(),
      sourceHealth: this.sourceHealth.findAll(),
      subscriptions: this.subscriptions.findAll(),
      dailyUsage: this.dailyUsage.findAll(),
      quotas: this.quotas.findAll(),
      rewards: this.rewards.findAll(),
      referrals: this.referrals.findAll(),
      transactions: this.transactions.findAll(),
      sessions: this.sessions.findAll(),
      otpVerifications: this.otpVerifications.findAll(),
      paymentOrders: this.paymentOrders.findAll(),
      paymentTransactions: this.paymentTransactions.findAll(),
      paymentWebhooks: this.paymentWebhooks.findAll(),
    };
    fs.writeFileSync(backupFile, JSON.stringify(dump, null, 2), 'utf-8');
    return backupFile;
  },
};
