-- ============================================================
-- COMPLETE DATABASE RESET
-- WARNING: This deletes ALL data in the public schema!
-- ============================================================

-- Drop all tables (cascades will handle foreign keys)
DROP TABLE IF EXISTS black_market_transactions CASCADE;
DROP TABLE IF EXISTS brothel_collections CASCADE;
DROP TABLE IF EXISTS brothel_workers CASCADE;
DROP TABLE IF EXISTS daily_contract_limits CASCADE;
DROP TABLE IF EXISTS contract_attempts CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS pvp_cooldowns CASCADE;
DROP TABLE IF EXISTS pvp_battles CASCADE;
DROP TABLE IF EXISTS player_inventory CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS business_collections CASCADE;
DROP TABLE IF EXISTS player_businesses CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS jail_records CASCADE;
DROP TABLE IF EXISTS crime_attempts CASCADE;
DROP TABLE IF EXISTS player_crime_experience CASCADE;
DROP TABLE IF EXISTS crimes CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS crime_players CASCADE;
DROP TABLE IF EXISTS page_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS giveaway_participants CASCADE;
DROP TABLE IF EXISTS giveaways CASCADE;
DROP TABLE IF EXISTS brutus_do_mes CASCADE;
DROP TABLE IF EXISTS user_clips CASCADE;
DROP TABLE IF EXISTS leaderboard_years CASCADE;
DROP TABLE IF EXISTS scheduled_streams CASCADE;
DROP TABLE IF EXISTS wheel_config CASCADE;
DROP TABLE IF EXISTS wheel_segments CASCADE;
DROP TABLE IF EXISTS spin_history CASCADE;
DROP TABLE IF EXISTS daily_sessions CASCADE;
DROP TABLE IF EXISTS fraud_config CASCADE;
DROP TABLE IF EXISTS geo_cache CASCADE;
DROP TABLE IF EXISTS fraud_logs CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS analytics_sessions CASCADE;
DROP TABLE IF EXISTS reward_redemptions CASCADE;
DROP TABLE IF EXISTS rewards CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS casino_offers CASCADE;
DROP TABLE IF EXISTS casino_affiliates CASCADE;
DROP TABLE IF EXISTS leaderboard CASCADE;
DROP TABLE IF EXISTS slot_requests CASCADE;
DROP TABLE IF EXISTS bonus_hunt_slots CASCADE;
DROP TABLE IF EXISTS bonus_hunt_sessions CASCADE;

-- Drop all custom types
DROP TYPE IF EXISTS worker_status CASCADE;
DROP TYPE IF EXISTS contract_difficulty CASCADE;
DROP TYPE IF EXISTS item_category CASCADE;
DROP TYPE IF EXISTS business_type CASCADE;
DROP TYPE IF EXISTS crime_difficulty CASCADE;
DROP TYPE IF EXISTS player_class CASCADE;

-- Success message
SELECT 'Database reset complete. All tables and types dropped.' AS status;
