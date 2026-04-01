-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/rbqwoiewrgcfbvotnaoj/sql

CREATE TABLE IF NOT EXISTS memories (
  id        text    PRIMARY KEY,
  date      date    NOT NULL,
  entry     text    DEFAULT '',
  qa        jsonb   DEFAULT '[]',
  mood      jsonb,
  sketch    text,
  ts        bigint  NOT NULL DEFAULT 0,
  location  jsonb
);

CREATE TABLE IF NOT EXISTS weeklies (
  id          text   PRIMARY KEY,
  week_key    text   NOT NULL,
  week_label  text,
  date        date,
  mood        jsonb,
  sketch      text,
  count       int    DEFAULT 0
);

-- Allow anonymous read/write (no auth in this app)
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeklies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access" ON memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON weeklies FOR ALL USING (true) WITH CHECK (true);
