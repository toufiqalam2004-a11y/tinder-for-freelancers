import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || process.env.DATABASE_DIR || path.join(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class JsonDatabase {
  constructor(filePath) {
    this.filePath = filePath;
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
    return this.data.find((item) => item.id === id || item._id === id);
  }

  findOne(predicate) {
    this.load();
    return this.data.find(predicate);
  }

  insert(record) {
    this.load();
    const existingIndex = this.data.findIndex((item) => item.id === record.id);
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
    const idx = this.data.findIndex((item) => item.id === id);
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
    this.data = this.data.filter((item) => item.id !== id);
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

export const db = {
  users: new JsonDatabase(path.join(DATA_DIR, 'users.json')),
  profiles: new JsonDatabase(path.join(DATA_DIR, 'profiles.json')),
  preferences: new JsonDatabase(path.join(DATA_DIR, 'preferences.json')),
  jobs: new JsonDatabase(path.join(DATA_DIR, 'jobs.json')),
  sources: new JsonDatabase(path.join(DATA_DIR, 'sources.json')),
  applications: new JsonDatabase(path.join(DATA_DIR, 'applications.json')),
  leads: new JsonDatabase(path.join(DATA_DIR, 'leads.json')),
  activities: new JsonDatabase(path.join(DATA_DIR, 'activities.json')),
  notifications: new JsonDatabase(path.join(DATA_DIR, 'notifications.json')),
  tasks: new JsonDatabase(path.join(DATA_DIR, 'tasks.json')),
  sourceHealth: new JsonDatabase(path.join(DATA_DIR, 'source_health.json')),
  subscriptions: new JsonDatabase(path.join(DATA_DIR, 'subscriptions.json')),
  dailyUsage: new JsonDatabase(path.join(DATA_DIR, 'daily_usage.json')),
  quotas: new JsonDatabase(path.join(DATA_DIR, 'quotas.json')),
  rewards: new JsonDatabase(path.join(DATA_DIR, 'rewards.json')),
  referrals: new JsonDatabase(path.join(DATA_DIR, 'referrals.json')),
  transactions: new JsonDatabase(path.join(DATA_DIR, 'transactions.json')),

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
      version: '6.0.0',
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
    };
    fs.writeFileSync(backupFile, JSON.stringify(dump, null, 2), 'utf-8');
    return backupFile;
  },
};
