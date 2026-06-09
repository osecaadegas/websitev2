-- Add KYC and VPN columns to casino_offers
-- Run this in the Supabase SQL Editor

ALTER TABLE casino_offers
  ADD COLUMN IF NOT EXISTS kyc_required boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS vpn_friendly boolean DEFAULT false;

-- Update existing rows to sensible defaults
UPDATE casino_offers
SET
  kyc_required = true,
  vpn_friendly = false
WHERE kyc_required IS NULL OR vpn_friendly IS NULL;
