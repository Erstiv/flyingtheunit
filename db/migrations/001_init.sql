-- Flyingtheunit: Core Schema
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Platforms enum
CREATE TYPE platform_type AS ENUM (
    'reddit', 'youtube', 'bluesky', 'mastodon', 'hackernews',
    'discourse', 'rss', 'twitter', 'tiktok', 'instagram',
    'linkedin', 'facebook', 'other'
);

CREATE TYPE sentiment_label AS ENUM ('positive', 'negative', 'neutral', 'mixed');

-- Topics: what we're tracking
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    keywords TEXT[] NOT NULL,  -- array of search terms
    platforms platform_type[] DEFAULT '{}',  -- which platforms to monitor (empty = all)
    is_active BOOLEAN DEFAULT true,
    collection_interval_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts: normalized content from all platforms
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform platform_type NOT NULL,
    platform_id VARCHAR(512) NOT NULL,  -- original ID on the platform
    author_id VARCHAR(512),
    author_username VARCHAR(255),
    author_display_name VARCHAR(512),
    content TEXT,
    content_html TEXT,
    url TEXT,
    parent_id UUID REFERENCES posts(id),  -- for replies
    thread_root_id UUID REFERENCES posts(id),  -- top-level post in thread
    media_urls TEXT[],
    engagement JSONB DEFAULT '{}',  -- {likes, replies, shares, views, etc.}
    raw_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, platform_id)
);

-- Post analysis: NLP results
CREATE TABLE post_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    sentiment_score REAL,  -- -1.0 to 1.0
    sentiment_label sentiment_label,
    emotions JSONB DEFAULT '{}',  -- {joy: 0.8, anger: 0.1, ...}
    entities JSONB DEFAULT '[]',  -- [{name, type, start, end}, ...]
    topics JSONB DEFAULT '[]',  -- [{label, score}, ...]
    aspect_sentiments JSONB DEFAULT '[]',  -- [{aspect, sentiment, score}, ...]
    embedding vector(384),  -- all-MiniLM-L6-v2
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id)
);

-- Canonical entities: people, orgs, products resolved across platforms
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(512) NOT NULL,
    entity_type VARCHAR(50) DEFAULT 'person',  -- person, org, product, etc.
    description TEXT,
    influence_score REAL DEFAULT 0.0,
    merged_into UUID REFERENCES entities(id),  -- for dedup/merge
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform-specific identities linked to canonical entities
CREATE TABLE entity_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    platform_user_id VARCHAR(512),
    username VARCHAR(255),
    display_name VARCHAR(512),
    profile_url TEXT,
    bio TEXT,
    avatar_url TEXT,
    follower_count INTEGER,
    confidence REAL DEFAULT 1.0,  -- 0-1, how sure we are this identity belongs to this entity
    raw_profile JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, platform_user_id)
);

-- Topic <-> Post many-to-many with relevance
CREATE TABLE topic_posts (
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    relevance_score REAL DEFAULT 1.0,
    PRIMARY KEY (topic_id, post_id)
);

-- Hourly volume snapshots for time-series
CREATE TABLE volume_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    platform platform_type,
    hour TIMESTAMPTZ NOT NULL,
    post_count INTEGER DEFAULT 0,
    avg_sentiment REAL,
    dominant_emotion VARCHAR(50),
    UNIQUE(topic_id, platform, hour)
);

-- Alert rules
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,  -- volume_spike, sentiment_shift, new_entity
    threshold JSONB NOT NULL,  -- {min_posts: 50, window_hours: 1} or {sentiment_delta: 0.3}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggered alert events
CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX idx_posts_platform ON posts(platform);
CREATE INDEX idx_posts_platform_id ON posts(platform, platform_id);
CREATE INDEX idx_posts_author ON posts(author_username);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_content_trgm ON posts USING gin(content gin_trgm_ops);
CREATE INDEX idx_post_analysis_sentiment ON post_analysis(sentiment_label);
CREATE INDEX idx_post_analysis_embedding ON post_analysis USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_entity_identities_username ON entity_identities(username);
CREATE INDEX idx_entity_identities_platform ON entity_identities(platform, username);
CREATE INDEX idx_volume_snapshots_topic_hour ON volume_snapshots(topic_id, hour DESC);
CREATE INDEX idx_topic_posts_topic ON topic_posts(topic_id);
CREATE INDEX idx_topic_posts_post ON topic_posts(post_id);
