# StoriIA v2 — Data Model (Supabase / Postgres)

Ogni tabella è annotata con il blocco in cui va introdotta. Costruisci
solo le tabelle MVP alla Fase 1; le colonne segnate "(v1)"/"(v2)" possono
essere aggiunte come migration successive, ma è utile che l'agente
conosca lo schema finale per non progettare le tabelle MVP in un modo
che le renda difficili da estendere dopo.

## MVP

### `users` (auth Supabase nativa, nessuna tabella custom necessaria)
Un solo genitore admin per account.

### `families`
- `id`
- `parent_user_id` (FK users, unico — un genitore per famiglia in questa versione)
- `created_at`

### `child_profiles`
- `id`
- `family_id` (FK families)
- `name`
- `birth_year` o `age` (usato per calibrare fascia d'età di default in generazione)
- `avatar_preset_id` (FK avatar_presets)
- `created_at`, `updated_at`

### `avatar_presets`
- `id`
- `name`
- `image_url` o riferimento asset
- `is_free` (bool) — in MVP tutti `true`; in v1/v2 alcuni diventano a pagamento/punti

### `characters`
- `id`
- `owner_child_profile_id` (FK child_profiles — libreria di proprietà, ma
  selezionabile da tutta la famiglia in generazione, non solo dal
  proprietario)
- `family_id` (denormalizzato, utile per query "tutti i personaggi della
  famiglia" senza join multipli)
- `name`, `traits` (testo libero + eventuali tag preset)
- `created_at`

### `settings` (ambientazioni — nome scelto per evitare conflitto col
termine "impostazioni applicative")
- `id`
- `owner_child_profile_id` (FK child_profiles)
- `family_id`
- `name`, `description`
- `created_at`

### `moral_lessons`
- `id`
- `label` (es. "condividere", "coraggio", "gestire le paure", "amicizia")
- `is_free` (bool) — in MVP tutti `true`

### `stories`
- `id`
- `family_id`
- `character_id` (FK characters)
- `setting_id` (FK settings)
- `moral_lesson_id` (FK moral_lessons, nullable)
- `target_age_range` (es. enum: `0-3`, `4-6`, `7-10`)
- `generated_text`
- `created_at`

### `story_assignments`
- `id`
- `story_id` (FK stories)
- `child_profile_id` (FK child_profiles)
- `reading_status` (`new` / `in_progress` / `completed`)
- `last_read_position` (int, percentuale 0-100)
- `assigned_at`, `updated_at`

## v1 — aggiunte

### `credits_ledger`
- `id`, `family_id`, `amount`, `type` (`purchase`/`consumption`/`refund`),
  `story_id` (nullable, se legato a una generazione), `created_at`
- Nessun campo scadenza (deciso: crediti senza scadenza)

### `subscriptions`
- `id`, `family_id`, `tier` (`free`/`premium`/`family`), `status`
  (`active`/`frozen`/`cancelled`), `addon_profile_count`,
  `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`

### `points_ledger`
- `id`, `family_id`, `amount`, `source` (`story_generated`/`story_read`/
  `mission_completed`/`spent_cosmetic`), `created_at`

### `badges`
- `id`, `label`, `unlock_condition` (descrizione strutturata, es.
  `{"type": "stories_read", "count": 5}`)

### `family_badges`
- `id`, `family_id`, `badge_id`, `unlocked_at`

### `moderation_flags`
- `id`, `story_id` (nullable), `character_id`/`setting_id` (nullable),
  `stage` (`input`/`output`), `result` (`passed`/`blocked`/`retried`),
  `created_at` — nota: NON salvare qui il testo originale in chiaro se
  possibile evitarlo; se necessario per debug, applicare redazione

## v2 — aggiunte

### `admin_config`
- Gestita da pannello admin: preset avatar, testi fissi, morali,
  missioni — **mai API key**, quelle restano in variabili d'ambiente

### `gift_codes`
- `id`, `type` (`credits`/`subscription`), `amount_or_tier`, `redeemed_by`
  (nullable FK families), `created_at`, `redeemed_at`

### `content_reports`
- `id`, `story_id`, `reported_by_family_id`, `reason`, `status`,
  `created_at`

## Note trasversali per RLS (Row Level Security)

- Ogni tabella con `family_id` deve avere policy che limitano lettura/
  scrittura alla famiglia proprietaria
- La distinzione genitore/modalità bambino NON va gestita solo con ruoli
  a livello applicativo: la sessione "modalità bambino" deve portare un
  claim/flag che le RLS policy verificano esplicitamente, negando
  scrittura su `characters`, `settings`, `stories`, `credits_ledger`,
  `subscriptions` quando quel flag è attivo — indipendentemente da cosa
  mostra la UI
