-- ============================================================
-- OPTIONAL: Add New Enum Values to Existing Types
-- ============================================================
-- Only run this if you have an EXISTING Crime Empire database
-- that needs the 'pimp' class and brothel business types added.
-- 
-- For a FRESH database, skip this and run 2-crime-empire-idempotent.sql directly.
-- ============================================================

-- Add 'pimp' to player_class enum if it doesn't exist
do $$ 
declare
  enum_values text[];
begin
  select array_agg(enumlabel::text) into enum_values 
  from pg_enum 
  where enumtypid = 'player_class'::regtype;
  
  if not 'pimp' = any(enum_values) then
    alter type player_class add value 'pimp';
    raise notice 'Added pimp to player_class enum';
  else
    raise notice 'pimp already exists in player_class enum';
  end if;
exception 
  when undefined_object then
    raise notice 'player_class enum does not exist yet - will be created by main script';
end $$;

-- Add brothel types to business_type enum if they don't exist
do $$ 
declare
  enum_values text[];
  added_count int := 0;
begin
  select array_agg(enumlabel::text) into enum_values 
  from pg_enum 
  where enumtypid = 'business_type'::regtype;
  
  if not 'brothel_basic' = any(enum_values) then
    alter type business_type add value 'brothel_basic';
    added_count := added_count + 1;
  end if;
  
  if not 'brothel_upgraded' = any(enum_values) then
    alter type business_type add value 'brothel_upgraded';
    added_count := added_count + 1;
  end if;
  
  if not 'brothel_luxury' = any(enum_values) then
    alter type business_type add value 'brothel_luxury';
    added_count := added_count + 1;
  end if;
  
  if not 'brothel_exclusive' = any(enum_values) then
    alter type business_type add value 'brothel_exclusive';
    added_count := added_count + 1;
  end if;
  
  if not 'brothel_empire' = any(enum_values) then
    alter type business_type add value 'brothel_empire';
    added_count := added_count + 1;
  end if;
  
  if added_count > 0 then
    raise notice 'Added % brothel type(s) to business_type enum', added_count;
  else
    raise notice 'All brothel types already exist in business_type enum';
  end if;
exception 
  when undefined_object then
    raise notice 'business_type enum does not exist yet - will be created by main script';
end $$;

select 'Enum migration complete! Now run 2-crime-empire-idempotent.sql' as status;
