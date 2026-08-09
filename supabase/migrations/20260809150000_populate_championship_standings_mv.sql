-- Populate the standings cache after restores and fresh environments.
-- The existing triggers keep it refreshed after subsequent match changes.
refresh materialized view public.championship_standings_mv;
