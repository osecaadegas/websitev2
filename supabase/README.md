# Database Setup Instructions

Run these SQL files **in order** in your Supabase SQL Editor:

## 🔴 Step 1: Reset Database (OPTIONAL - DESTRUCTIVE!)

**⚠️ WARNING: This deletes ALL data!**

```sql
-- Run: 0-reset-database.sql
```

Only run this if you want to completely wipe your database and start fresh.

## ✅ Step 2: SecaHub Website Schema

```sql
-- Run: 1-secahub-schema.sql
```

Creates all website tables:
- Bonus Hunt sessions & slots
- Casino offers & affiliates
- User authentication
- Notifications
- Rewards & redemptions
- Analytics & fraud detection
- Daily sessions
- Wheel system (Roda Diária)
- Scheduled streams
- Liga dos Secas (yearly leaderboard)
- Giveaway system
- Hall of Victories (Bruta do Mês + user clips)
- Page settings (backgrounds & effects)

**Includes:** 23 default page settings already inserted.

## 🎮 Step 3: Crime Empire Game Schema

```sql
-- Run: 2-crime-empire.sql
```

Creates all Crime Empire game tables:
- Player system (8 classes)
- Crime system with difficulty levels
- Jail system
- Business ownership
- Items & inventory
- PvP battles
- Hitman contracts
- Brothel workers
- Black market
- Player stats tracking

**Includes:** 
- 7 starter crimes (Roubar Carteira → Heist do Casino)
- 5 businesses (Quinta Cannabis → Nightclub)
- 4 starter items (Pistola, Colete, Laptop, Fato)

---

## 🎯 Quick Start (Clean Install)

If starting from scratch:

1. Open Supabase SQL Editor
2. Run `0-reset-database.sql` (deletes everything)
3. Run `1-secahub-schema.sql` (creates website)
4. Run `2-crime-empire.sql` (creates game)
5. Done! ✅

---

## 📝 Notes

- All SQL files are **idempotent** where possible
- RLS (Row Level Security) is enabled on all tables
- Default policies allow public read access
- Admin operations simplified (add proper role checks in production)
- Functions included for GDPR compliance (`delete_user_analytics`, `delete_ip_analytics`)
- Helper functions for clip honors (`increment_clip_honors`, `decrement_clip_honors`)
