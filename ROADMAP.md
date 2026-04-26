# Crime Empire — Remaining Roadmap

Last shipped commit: `c57b8b9a` (Phase 2.5 + 3 + 4 reward pops & level-up overlay)

---

## 🔴 High priority — gameplay correctness

### 1. XP race condition on `xp_buckets`
- **Problem**: `grantXP()` in `src/lib/crime-empire/xp.ts` does read-modify-write on `crime_players.xp_buckets`. Two concurrent crimes can lose XP grants.
- **Fix**: Move bucket update into a Postgres function with `SELECT ... FOR UPDATE` on the player row, or use `jsonb_set` in a single `UPDATE ... RETURNING` round-trip.
- **SQL needed**: new function `ce_grant_xp_atomic(player_id, source, amount, hourly_caps jsonb)` returning new `{xp, level, leveled_up}`.

### 2. PvP elo-style normalization
- Current PvP loot formula `floor((250 + loser.level × 12) × powerMargin)` lets high-levels farm low-levels with no diminishing returns.
- Add level-gap multiplier: `lootMult = clamp(1 - (atkLevel - defLevel) × 0.08, 0.2, 1.0)`.
- File: `src/app/api/crime-empire/pvp/route.ts` (search for `lootAmount`).

### 3. Crime XP modifiers from owned businesses
- Backend already supports `xp_multiplier` on `crime_businesses` rows but `commitCrime` doesn't read them.
- File: `src/app/api/crime-empire/crimes/route.ts` — fetch active businesses, apply combined multiplier to `xp_earned`.

---

## 🟡 Medium priority — polish

### 4. Gambling tile-level animations
- **Mines**: cell flip on reveal, mine explosion shake, win shine sweep on cashout.
- **Keno**: stagger drawn-number reveal (already have one — sharpen with framer `AnimatePresence`).
- **Blackjack**: card-deal animation (offscreen → table position), bust/win banner using `ce-card--metal-blood`/`acid`.
- Files: `src/app/jogos/crime-empire/gambling/{mines,keno,blackjack}/page.tsx`.

### 5. XP bar smoother fill + percent label
- Current `MiniBar` in `CEFloatingMenu.tsx` already has `transition-all duration-700`. Upgrade with `useTickingNumber` for the `xp / xp_to_next` numeric label too.
- Add subtle pulse glow when within 10% of next level.

### 6. Per-page reward pop X-jitter improvements
- `pushReward()` defaults Y to `35vh`, X jitter `45-55%`. Looks fine but stacks ugly when 3+ rewards fire same frame (e.g. PvP win = 2 pops, mission claim = 3).
- Add an internal queue with vertical offset based on active count, OR tilt jitter wider.
- File: `src/components/crime-empire/ui/GlobalRewardLayer.tsx`.

---

## 🟢 Low priority — nice-to-have

### 7. Sound effects on reward pops
- Hook `pushReward()` to play `coin.ogg` (cash), `xp.ogg` (xp), `crit.ogg` (damage). Use existing `useArmorySound` pattern.

### 8. Level-up overlay sound + screen flash
- Currently silent. Add `levelup.ogg` and a 0.3s white flash via framer.

### 9. Daily streak / login bonus visual
- Already exists in missoes streak card (got `ce-card--metal-gold`). Add per-day milestone callout with `pushReward("gold", "🔥 Streak +N")`.

### 10. Hall of victories metallic frames
- Apply `ce-card--metal-violet` to top-3 entries in `src/components/HallOfVictoriesContent.tsx` (website side — uses `arena-*` namespace, NOT `ce-*`). **Skip if mixing namespaces.**

---

## 📋 SQL pending

`xp-curve-rebalance.sql` — already in repo, needs to be run in Supabase:
```sql
-- Run in Supabase SQL editor
-- File: supabase/xp-curve-rebalance.sql
```
This adds `xp_buckets` jsonb column and replaces the curve function. **Required before item #1 fix above.**

---

## 🚫 Do NOT touch (per user constraints)
- Website components: `Footer`, `Navbar`, `AgeGate`, `Sidebar` (NOT `CrimeEmpireSidebar`)
- The `--arena-*` CSS namespace (website-only)
- Mixing game and website state

---

## Workflow reminder
```powershell
$env:NEXT_TELEMETRY_DISABLED=1; npx next build
git add -A
git commit -m "feat(crime-empire-ui): <description>"
git push origin main
```
Use `;` not `&&` (PowerShell).
