-- ============================================================
-- UK Phone Validation — SQL Server schema
-- Matches the exact fields the workstation produces.
-- Run in SSMS or:  sqlcmd -S <server> -d <db> -i database/schema.sql
-- ============================================================

IF DB_ID('PhoneValidation') IS NULL
    CREATE DATABASE PhoneValidation;
GO
USE PhoneValidation;
GO

-- ── Import batches (one row per validation run / upload) ─────
IF OBJECT_ID('dbo.ImportBatch','U') IS NULL
CREATE TABLE dbo.ImportBatch (
    batch_id     INT IDENTITY(1,1) PRIMARY KEY,
    name         NVARCHAR(200)  NULL,            -- dataset name from the app
    source_files NVARCHAR(MAX)  NULL,            -- comma-separated file names
    imported_at  DATETIME2(0)   NOT NULL DEFAULT SYSUTCDATETIME(),
    total_rows   INT            NOT NULL DEFAULT 0
);
GO

-- ── Contacts (the cleaned, enriched records) ────────────────
IF OBJECT_ID('dbo.Contacts','U') IS NULL
CREATE TABLE dbo.Contacts (
    contact_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    batch_id      INT          NULL REFERENCES dbo.ImportBatch(batch_id),

    -- Phone (canonical)
    phone_e164    VARCHAR(20)  NULL,             -- +447911123456
    country       CHAR(2)      NULL,             -- GB, US…
    line_type     VARCHAR(20)  NULL,             -- Landline / Mobile / VoIP / Premium / …
    status        VARCHAR(20)  NULL,             -- landline / mobile / other / invalid / duplicate

    -- Free local enrichment
    area          NVARCHAR(60) NULL,             -- town/region from area code
    ofcom_block   VARCHAR(12)  NULL,             -- allocated / unallocated / unknown
    carrier       NVARCHAR(120) NULL,            -- originally-allocated CP
    quality       VARCHAR(12)  NULL,             -- ok / suspect / reserved / round
    quality_reason NVARCHAR(80) NULL,

    -- Compliance / live
    tps_registered BIT         NULL,             -- 1 = on TPS/CTPS/API suppression
    suppress_source VARCHAR(8) NULL,             -- TPS / CTPS / API
    live_check    VARCHAR(10)  NULL,             -- active / dead / unknown

    -- Common contact columns (filled when present in the source)
    first_name    NVARCHAR(100) NULL,
    last_name     NVARCHAR(100) NULL,
    email         NVARCHAR(320) NULL,
    town          NVARCHAR(100) NULL,
    postcode      NVARCHAR(20)  NULL,

    -- Everything else from the original row, preserved as JSON
    raw_data      NVARCHAR(MAX) NULL,

    created_at    DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ── Indexes for the common queries ──────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_Contacts_phone')
    CREATE UNIQUE INDEX UX_Contacts_phone ON dbo.Contacts(phone_e164)
        WHERE phone_e164 IS NOT NULL;            -- dedupe at the DB level too
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Contacts_status')
    CREATE INDEX IX_Contacts_status ON dbo.Contacts(status) INCLUDE(phone_e164, line_type);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Contacts_tps')
    CREATE INDEX IX_Contacts_tps ON dbo.Contacts(tps_registered) INCLUDE(phone_e164);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Contacts_area')
    CREATE INDEX IX_Contacts_area ON dbo.Contacts(area);
GO

-- ── View: ready-to-dial, compliant callable list ────────────
CREATE OR ALTER VIEW dbo.vw_Callable AS
SELECT contact_id, batch_id, phone_e164, line_type, area, carrier,
       first_name, last_name, email, town, postcode
FROM   dbo.Contacts
WHERE  status IN ('landline','mobile')
  AND  ISNULL(tps_registered,0) = 0
  AND  quality = 'ok'
  AND  (live_check IS NULL OR live_check <> 'dead');
GO

-- ============================================================
-- LOADING DATA
-- Option A — the app's "Export SQL" button: produces a .sql of
--   INSERT statements you run directly (best for up to ~100k rows).
--
-- Option B — bulk import the exported CSV (best for millions):
--   1) Export the results to CSV from the app.
--   2) BULK INSERT into a staging table, then INSERT…SELECT here.
--
--   Example:
--   BULK INSERT dbo.Contacts_staging
--   FROM 'C:\path\all_processed.csv'
--   WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a');
-- ============================================================
