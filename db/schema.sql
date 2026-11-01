-- PostgreSQL 16+. Apply once to a new database using a migration tool.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE media_kind AS ENUM ('movie','series','anime','documentary');
CREATE TYPE download_state AS ENUM ('queued','downloading','paused','complete','failed','expired');
CREATE TYPE viewing_event_type AS ENUM ('impression','start','progress','pause','complete','dismiss');
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auth_subject text UNIQUE NOT NULL,
 email text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE TABLE profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 name varchar(40) NOT NULL, avatar_url text, is_kids boolean NOT NULL DEFAULT false,
 max_age_rating smallint NOT NULL DEFAULT 18 CHECK(max_age_rating BETWEEN 0 AND 18),
 pin_hash text, pin_failed_attempts smallint NOT NULL DEFAULT 0 CHECK(pin_failed_attempts >= 0),
 pin_locked_until timestamptz, locale varchar(20) NOT NULL DEFAULT 'en',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,name), UNIQUE(id,user_id)
);
CREATE TABLE media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, synopsis text NOT NULL,
 kind media_kind NOT NULL, release_year smallint NOT NULL CHECK(release_year>=1888),
 original_language varchar(50) NOT NULL, countries char(2)[] NOT NULL DEFAULT '{}', genres text[] NOT NULL DEFAULT '{}',
 age_rating smallint NOT NULL CHECK(age_rating BETWEEN 0 AND 18), duration_seconds integer CHECK(duration_seconds>0),
 imdb_rating numeric(3,1) CHECK(imdb_rating BETWEEN 0 AND 10), popularity numeric NOT NULL DEFAULT 0,
 poster_url text, backdrop_url text, trailer_asset_key text, published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- Movies are media rows with kind=movie; series own episodes.
CREATE VIEW movies AS SELECT * FROM media WHERE kind='movie';
CREATE TABLE episodes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE,
 season_number integer NOT NULL CHECK(season_number>0), episode_number integer NOT NULL CHECK(episode_number>0),
 title text NOT NULL, synopsis text, duration_seconds integer NOT NULL CHECK(duration_seconds>0),
 released_at timestamptz, UNIQUE(media_id,season_number,episode_number), UNIQUE(id,media_id)
);
CREATE TABLE stream_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE,
 episode_id uuid, source_label varchar(80) NOT NULL, manifest_key text NOT NULL,
 protocol text NOT NULL CHECK(protocol IN ('hls','dash')), drm_key_id text,
 max_resolution integer NOT NULL CHECK(max_resolution IN (480,720,1080,2160)),
 audio_languages text[] NOT NULL DEFAULT '{}', subtitle_languages text[] NOT NULL DEFAULT '{}',
 priority smallint NOT NULL DEFAULT 100 CHECK(priority >= 0), region varchar(32),
 available_from timestamptz, available_until timestamptz, enabled boolean NOT NULL DEFAULT true,
 FOREIGN KEY(episode_id,media_id) REFERENCES episodes(id,media_id),
 UNIQUE NULLS NOT DISTINCT(media_id,episode_id,source_label),
 CHECK(available_until IS NULL OR available_from IS NULL OR available_until > available_from)
);
CREATE TABLE media_rights (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE,
 country char(2) NOT NULL, valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL,
 offline_allowed boolean NOT NULL DEFAULT false, CHECK(valid_until>valid_from),
 CHECK(country ~ '^[A-Z]{2}$')
);
CREATE TABLE watchlist (
 profile_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(profile_id,media_id)
);
CREATE TABLE devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 name text NOT NULL,platform text NOT NULL CHECK(platform IN ('ios','android','web')),
 created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,user_id)
);
CREATE TABLE playback_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE,episode_id uuid,
 position_seconds numeric NOT NULL DEFAULT 0 CHECK(position_seconds>=0),duration_seconds numeric NOT NULL CHECK(duration_seconds>0),
 completed boolean NOT NULL DEFAULT false,version bigint NOT NULL DEFAULT 1,
 last_event_id uuid NOT NULL UNIQUE, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(episode_id,media_id) REFERENCES episodes(id,media_id), CHECK(position_seconds<=duration_seconds),
 UNIQUE NULLS NOT DISTINCT(profile_id,media_id,episode_id)
);
CREATE TABLE downloads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL,
 device_id uuid NOT NULL, user_id uuid NOT NULL, asset_id uuid NOT NULL REFERENCES stream_assets ON DELETE CASCADE,
 resolution integer NOT NULL CHECK(resolution IN (480,720,1080,2160)),state download_state NOT NULL DEFAULT 'queued',
 bytes_downloaded bigint NOT NULL DEFAULT 0 CHECK(bytes_downloaded>=0),total_bytes bigint CHECK(total_bytes>0),
 license_expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(profile_id,device_id,asset_id),CHECK(total_bytes IS NULL OR bytes_downloaded<=total_bytes),
 FOREIGN KEY(profile_id,user_id) REFERENCES profiles(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(device_id,user_id) REFERENCES devices(id,user_id) ON DELETE CASCADE
);
CREATE TABLE ratings (
 profile_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE,
 stars smallint NOT NULL CHECK(stars BETWEEN 1 AND 5),
 review text CHECK(review IS NULL OR length(btrim(review)) BETWEEN 1 AND 2000),
 moderation_status text NOT NULL DEFAULT 'pending' CHECK(moderation_status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(profile_id,media_id)
);
CREATE TABLE comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE,parent_id uuid,
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 2000),moderation_status text NOT NULL DEFAULT 'pending'
 CHECK(moderation_status IN ('pending','approved','rejected')),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,media_id), FOREIGN KEY(parent_id,media_id) REFERENCES comments(id,media_id) ON DELETE CASCADE
);
CREATE TABLE playlists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 title varchar(120) NOT NULL CHECK(length(btrim(title)) > 0),description text,
 public boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE playlist_items (
 playlist_id uuid NOT NULL REFERENCES playlists ON DELETE CASCADE,media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE,
 position integer NOT NULL CHECK(position>=0),PRIMARY KEY(playlist_id,media_id),UNIQUE(playlist_id,position)
);
CREATE TABLE viewing_events (
 id uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE, episode_id uuid,
 device_id uuid REFERENCES devices ON DELETE SET NULL, session_id uuid,
 event_type viewing_event_type NOT NULL, position_seconds numeric CHECK(position_seconds >= 0),
 occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 metadata jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(metadata) = 'object'),
 FOREIGN KEY(episode_id,media_id) REFERENCES episodes(id,media_id)
);
CREATE TABLE recommendation_sets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
 algorithm varchar(80) NOT NULL, reason varchar(160), generated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, CHECK(expires_at > generated_at)
);
CREATE TABLE recommendation_items (
 recommendation_set_id uuid NOT NULL REFERENCES recommendation_sets ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE, rank smallint NOT NULL CHECK(rank > 0),
 score numeric NOT NULL, explanation varchar(200),
 PRIMARY KEY(recommendation_set_id,media_id), UNIQUE(recommendation_set_id,rank)
);
CREATE TABLE daily_rankings (
 country char(2) NOT NULL CHECK(country ~ '^[A-Z]{2}$'), ranking_date date NOT NULL,
 media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE, rank smallint NOT NULL CHECK(rank BETWEEN 1 AND 10),
 engaged_profiles integer NOT NULL CHECK(engaged_profiles >= 0),
 PRIMARY KEY(country,ranking_date,media_id), UNIQUE(country,ranking_date,rank)
);
CREATE INDEX media_browse ON media(published,popularity DESC,id);
CREATE INDEX media_genres ON media USING gin(genres);
CREATE INDEX media_search ON media USING gin(to_tsvector('english',title||' '||synopsis));
CREATE INDEX history_recent ON playback_history(profile_id,updated_at DESC);
CREATE INDEX profile_owner ON profiles(user_id);
CREATE INDEX episode_parent ON episodes(media_id);
CREATE INDEX stream_asset_lookup ON stream_assets(media_id,episode_id,enabled,priority);
CREATE INDEX active_media_rights ON media_rights(media_id,country,valid_from,valid_until);
CREATE INDEX watchlist_recent ON watchlist(profile_id,created_at DESC);
CREATE INDEX reviews_media ON ratings(media_id,moderation_status);
CREATE INDEX comments_media ON comments(media_id,created_at);
CREATE INDEX downloads_profile ON downloads(profile_id,device_id);
CREATE INDEX public_playlists ON playlists(updated_at DESC) WHERE public = true;
CREATE INDEX viewing_events_profile ON viewing_events(profile_id,occurred_at DESC);
CREATE INDEX viewing_events_media ON viewing_events(media_id,event_type,occurred_at DESC);
CREATE INDEX recommendation_sets_profile ON recommendation_sets(profile_id,generated_at DESC);

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.updated_at = now();
 RETURN NEW;
END;
$$;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER media_updated_at BEFORE UPDATE ON media FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER playback_history_updated_at BEFORE UPDATE ON playback_history FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER downloads_updated_at BEFORE UPDATE ON downloads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ratings_updated_at BEFORE UPDATE ON ratings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER playlists_updated_at BEFORE UPDATE ON playlists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Database is server-only. Never expose a privileged PostgreSQL role to clients.
-- Tenant ownership must be enforced by every API; configure RLS before direct Supabase access.
COMMIT;
