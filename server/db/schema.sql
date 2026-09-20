-- =====================================================================
-- TINDER FOR FREELANCERS — V1 SUPABASE POSTGRESQL SCHEMA
-- Authoritative Non-Destructive DDL Specification
-- Zero DROP statements. Safe CREATE TABLE IF NOT EXISTS & ALTER TABLE.
-- =====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =====================================================================
-- 2. USERS (Identity, Auth, Roles, Ban Status, Referral Code)
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    country_code VARCHAR(8) NOT NULL DEFAULT '+91',
    local_number VARCHAR(16) NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    email CITEXT,
    username CITEXT,
    role VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    plan VARCHAR(16) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus', 'pro')),
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    ban_type VARCHAR(16) CHECK (ban_type IN ('temporary', 'permanent', NULL)),
    ban_until TIMESTAMPTZ,
    referral_code VARCHAR(16) NOT NULL,
    referred_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    referral_code_used VARCHAR(16),
    referral_status VARCHAR(16) CHECK (referral_status IN ('pending', 'completed', NULL)),
    referral_created_at TIMESTAMPTZ,
    referral_reward_granted_at TIMESTAMPTZ,
    is_new_user BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_referral_code UNIQUE (referral_code)
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Safe column additions if table already existed
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(8) DEFAULT '+91';
ALTER TABLE users ADD COLUMN IF NOT EXISTS local_number VARCHAR(16);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email CITEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username CITEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16) DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(16);

-- =====================================================================
-- 3. PROFILES (Freelancer Details, Skills, Portfolios, Verified Email)
-- =====================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    username CITEXT,
    email CITEXT NOT NULL,
    phone TEXT,
    country_code VARCHAR(8) DEFAULT '+91',
    local_number VARCHAR(16),
    profession TEXT DEFAULT '',
    primary_role TEXT DEFAULT '',
    secondary_roles JSONB DEFAULT '[]'::jsonb,
    category TEXT DEFAULT 'Creative',
    specialization TEXT DEFAULT '',
    skills JSONB DEFAULT '[]'::jsonb,
    experience TEXT DEFAULT '',
    years_of_experience INTEGER DEFAULT 3,
    bio TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    photo_url TEXT DEFAULT '',
    portfolio_url TEXT DEFAULT '',
    portfolio_links JSONB DEFAULT '[]'::jsonb,
    cv_url TEXT DEFAULT '',
    cv_parsed_skills JSONB DEFAULT '[]'::jsonb,
    preferred_job_types JSONB DEFAULT '["freelance", "contract"]'::jsonb,
    remote_preference VARCHAR(16) DEFAULT 'remote',
    expected_salary_min NUMERIC(10, 2) DEFAULT 500,
    expected_salary_max NUMERIC(10, 2) DEFAULT 3000,
    salary_type VARCHAR(16) DEFAULT 'per_month',
    currency VARCHAR(3) DEFAULT 'USD',
    availability VARCHAR(32) DEFAULT 'Immediately',
    headline TEXT DEFAULT '',
    account_type VARCHAR(16) DEFAULT 'freelancer',
    user_preferences JSONB DEFAULT '{}'::jsonb,
    outreach_preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_profiles_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email CITEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username CITEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio_links JSONB DEFAULT '[]'::jsonb;

-- =====================================================================
-- 4. SOURCES (Job Feed Aggregators & Scrapers)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL,
    name TEXT NOT NULL,
    url TEXT DEFAULT '',
    query TEXT DEFAULT '',
    type VARCHAR(16) NOT NULL DEFAULT 'custom' CHECK (type IN ('builtin', 'custom')),
    source_category VARCHAR(16) DEFAULT 'custom',
    sub_type VARCHAR(32) DEFAULT '',
    category VARCHAR(64) DEFAULT 'Creative & Video',
    fetch_interval INTEGER DEFAULT 15,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    last_fetched_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_user_id ON sources(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_platform ON sources(platform);

-- =====================================================================
-- 5. JOBS (Discovered Opportunities & Aggregated Listings)
-- =====================================================================
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
    platform VARCHAR(32) NOT NULL,
    post_id TEXT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    company TEXT DEFAULT 'Hiring Client',
    client TEXT DEFAULT 'Hiring Client',
    author TEXT DEFAULT 'Member',
    source_url TEXT DEFAULT '',
    post_url TEXT DEFAULT '',
    skills JSONB DEFAULT '[]'::jsonb,
    category VARCHAR(64) DEFAULT 'Creative',
    job_role TEXT DEFAULT '',
    job_type VARCHAR(32) DEFAULT 'freelance',
    salary TEXT DEFAULT 'Negotiable',
    location TEXT DEFAULT 'Remote',
    is_remote BOOLEAN NOT NULL DEFAULT TRUE,
    match_score INTEGER DEFAULT 85,
    match_reasons JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(16) NOT NULL DEFAULT 'new',
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    is_job BOOLEAN NOT NULL DEFAULT TRUE,
    has_direct_contact BOOLEAN NOT NULL DEFAULT FALSE,
    contact_email TEXT,
    contact_phone TEXT,
    contact JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_source_id ON jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_jobs_has_direct_contact ON jobs(has_direct_contact);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- =====================================================================
-- 6. APPLICATIONS (User Applications across All, Applied, Saved, Viewed)
-- =====================================================================
CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    company TEXT DEFAULT 'Hiring Client',
    platform VARCHAR(32) DEFAULT 'manual',
    source_url TEXT DEFAULT '',
    message TEXT NOT NULL,
    original_generated_message TEXT,
    channel VARCHAR(16) DEFAULT 'email',
    recipient TEXT DEFAULT '',
    status VARCHAR(24) NOT NULL DEFAULT 'applied' CHECK (
        status IN ('draft', 'applied', 'viewed', 'saved', 'interview', 'shortlisted', 'rejected', 'hired')
    ),
    status_history JSONB DEFAULT '[]'::jsonb,
    outreach_status VARCHAR(32) DEFAULT 'NOT_CONFIGURED',
    demo BOOLEAN NOT NULL DEFAULT FALSE,
    match_score INTEGER,
    qualification_result VARCHAR(32) DEFAULT 'QUALIFIED',
    message_id TEXT,
    source VARCHAR(32) DEFAULT 'manual',
    tone VARCHAR(32) DEFAULT 'Professional',
    length VARCHAR(16) DEFAULT 'Medium',
    language VARCHAR(16) DEFAULT 'English',
    cv_attached BOOLEAN DEFAULT TRUE,
    portfolio_included BOOLEAN DEFAULT TRUE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);

-- Unique index ensuring one canonical application record per user per job when job_id is present
CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_user_job ON applications (user_id, job_id) WHERE job_id IS NOT NULL;

-- =====================================================================
-- 7. SUBSCRIPTIONS (One Active Entitlement Row per User)
-- =====================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT,
    plan VARCHAR(16) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus', 'pro')),
    billing_cycle VARCHAR(16) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
    status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'expired')
    ),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),
    amount_major NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    amount_minor INTEGER NOT NULL DEFAULT 0,
    price NUMERIC(10, 2) DEFAULT 0.00,
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    scheduled_plan VARCHAR(16) CHECK (scheduled_plan IN ('free', 'plus', 'pro', NULL)),
    previous_plan VARCHAR(16),
    payment_provider VARCHAR(32) DEFAULT 'manual' CHECK (payment_provider IN ('razorpay', 'stripe', 'cashfree', 'manual')),
    provider_subscription_id TEXT,
    provider_customer_id TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    credits JSONB DEFAULT '[]'::jsonb,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscriptions_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(16) DEFAULT 'monthly';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_major NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_minor INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(32) DEFAULT 'manual';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_customer_id TEXT;

-- =====================================================================
-- 8. PAYMENT CUSTOMERS (Gateway Customer ID Mapping)
-- =====================================================================
CREATE TABLE IF NOT EXISTS payment_customers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL CHECK (provider IN ('razorpay', 'stripe', 'cashfree', 'custom')),
    provider_customer_id TEXT NOT NULL,
    email CITEXT NOT NULL,
    phone TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_customers_user_provider UNIQUE (user_id, provider),
    CONSTRAINT uq_payment_customers_provider_id UNIQUE (provider, provider_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_customers_user ON payment_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_customers_provider_id ON payment_customers(provider, provider_customer_id);

-- =====================================================================
-- 9. PAYMENT ORDERS (Pre-Charge Checkout Intents & Invoices)
-- =====================================================================
CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
    plan VARCHAR(16) NOT NULL CHECK (plan IN ('plus', 'pro')),
    billing_cycle VARCHAR(16) NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
    amount_major NUMERIC(10, 2) NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),
    provider VARCHAR(32) NOT NULL CHECK (provider IN ('razorpay', 'stripe', 'cashfree')),
    provider_order_id TEXT,
    idempotency_key TEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'created' CHECK (
        status IN ('created', 'attempted', 'paid', 'failed', 'expired')
    ),
    receipt_number TEXT,
    notes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
    CONSTRAINT uq_payment_orders_provider_order_id UNIQUE (provider_order_id),
    CONSTRAINT uq_payment_orders_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT uq_payment_orders_receipt UNIQUE (receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_id ON payment_orders(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);

-- =====================================================================
-- 10. PAYMENT TRANSACTIONS (Immutable Financial Ledger & Receipts)
-- =====================================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES payment_orders(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
    provider VARCHAR(32) NOT NULL CHECK (provider IN ('razorpay', 'stripe', 'cashfree', 'manual')),
    provider_payment_id TEXT,
    provider_signature TEXT,
    amount_major NUMERIC(10, 2) NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),
    status VARCHAR(24) NOT NULL CHECK (status IN ('successful', 'failed', 'authorized', 'refunded', 'disputed')),
    payment_method VARCHAR(32),
    failure_code TEXT,
    failure_reason TEXT,
    is_refunded BOOLEAN NOT NULL DEFAULT FALSE,
    amount_refunded_major NUMERIC(10, 2) DEFAULT 0.00,
    amount_refunded_minor INTEGER DEFAULT 0,
    paid_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_txns_provider_payment_id UNIQUE (provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_txns_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_txns_provider_id ON payment_transactions(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_txns_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_txns_created_at ON payment_transactions(created_at DESC);

-- =====================================================================
-- 11. PAYMENT WEBHOOKS (Idempotent Event Log & Lock State)
-- =====================================================================
CREATE TABLE IF NOT EXISTS payment_webhooks (
    id TEXT PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    event_id TEXT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_webhooks_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_event ON payment_webhooks(provider, event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_status ON payment_webhooks(status);

-- =====================================================================
-- 12. QUOTAS (Rolling 8-Hour Quotas: Free=5, Plus=15, Pro=25)
-- =====================================================================
CREATE TABLE IF NOT EXISTS quotas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(16) NOT NULL DEFAULT 'free',
    applications_used INTEGER NOT NULL DEFAULT 0,
    window_start BIGINT NOT NULL,
    window_end BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_quotas_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_quotas_user_id ON quotas(user_id);

-- =====================================================================
-- 13. DAILY USAGE (Calendar-Day Aggregates)
-- =====================================================================
CREATE TABLE IF NOT EXISTS daily_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    applications_used INTEGER NOT NULL DEFAULT 0,
    ai_apply_used INTEGER NOT NULL DEFAULT 0,
    saved_searches_created INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_usage_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);

-- =====================================================================
-- 14. REWARDS (Streaks & Bonus Tokens)
-- =====================================================================
CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_credits INTEGER NOT NULL DEFAULT 0,
    total_reward_credits INTEGER NOT NULL DEFAULT 0,
    bonus_tokens INTEGER NOT NULL DEFAULT 0,
    total_bonus_tokens_earned INTEGER NOT NULL DEFAULT 0,
    streak_count INTEGER NOT NULL DEFAULT 0,
    last_streak_login_date DATE,
    last_streak_milestone_rewarded INTEGER NOT NULL DEFAULT 0,
    last_daily_login_reward_date DATE,
    daily_login_rewards_claimed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rewards_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_rewards_user_id ON rewards(user_id);

-- =====================================================================
-- 15. REFERRALS (Invite Tracking & Bonus Distribution)
-- =====================================================================
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referrer_code VARCHAR(16) NOT NULL,
    referee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_phone TEXT NOT NULL,
    bonus_credits INTEGER NOT NULL DEFAULT 5,
    status VARCHAR(16) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_referrals_referee_id UNIQUE (referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON referrals(referee_id);

-- =====================================================================
-- 16. PREFERENCES (User Auto-Delete & Outreach Toggles)
-- =====================================================================
CREATE TABLE IF NOT EXISTS preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auto_delete_applications_after_7_days BOOLEAN NOT NULL DEFAULT FALSE,
    quick_apply_enabled BOOLEAN DEFAULT FALSE,
    contact_preference VARCHAR(16) DEFAULT 'both',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_preferences_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON preferences(user_id);

-- =====================================================================
-- 17. SESSIONS (Persistent Token Authentication Surviving Restarts)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    country_code VARCHAR(8) NOT NULL DEFAULT '+91',
    local_number VARCHAR(16) NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'user',
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- =====================================================================
-- 18. OTP VERIFICATIONS (Persistent Rate-Limiting & Cooldowns)
-- =====================================================================
CREATE TABLE IF NOT EXISTS otp_verifications (
    phone TEXT PRIMARY KEY,
    code VARCHAR(8) NOT NULL,
    country_code VARCHAR(8) NOT NULL DEFAULT '+91',
    local_number VARCHAR(16) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);

-- =====================================================================
-- 19. ACTIVITIES (Administrative Action & Audit Log)
-- =====================================================================
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    type VARCHAR(64) NOT NULL,
    actor VARCHAR(64) NOT NULL DEFAULT 'System',
    admin_id TEXT,
    lead_id TEXT,
    lead_name TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    message TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'info',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
