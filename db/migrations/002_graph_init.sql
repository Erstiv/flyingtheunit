-- Flyingtheunit: Apache AGE Graph Schema
-- Load AGE extension
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- Create the social graph
SELECT create_graph('social_graph');

-- Node types will be created dynamically:
--   Entity: {id, name, type, influence_score}
--   Post: {id, platform, content_preview, sentiment, created_at}
--   Topic: {id, name}
--   Platform: {name}
--
-- Edge types:
--   POSTED: Entity -> Post
--   REPLY_TO: Post -> Post
--   MENTIONS: Post -> Entity
--   ABOUT: Post -> Topic
--   FOLLOWS: Entity -> Entity
--   COLLABORATES_WITH: Entity -> Entity
--   ACTIVE_ON: Entity -> Platform
--   SAME_AS: Entity -> Entity {confidence: float}
