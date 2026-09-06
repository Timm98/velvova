-- Monatliche Kosten und die aktuelle Stelle.
--
-- Beides gehört zusammen, weil beides dieselbe Frage beantwortet: Was
-- bleibt mir tatsächlich, und lohnt sich ein Wechsel?
--
-- Ein Bruttogehalt beantwortet diese Frage nicht. „70.000 statt 63.000"
-- klingt nach siebentausend; nach Steuern, Sozialabgaben und einem
-- längeren Arbeitsweg bleiben davon vielleicht hundertfünfzig Euro im
-- Monat — und dreissig Stunden weniger Freizeit im Jahr.
--
-- ZUR VERTRAULICHKEIT: Diese Angaben sind privat. Sie sind KEINE
-- Karriere-Belege, gehen nicht in Bewerbungsunterlagen, erreichen
-- keinen Arbeitgeber und gehören nicht in einen Modellkontext. Sie
-- stehen deshalb bewusst in eigenen Tabellen und nicht am
-- Karriereprofil.
CREATE TABLE IF NOT EXISTS living_costs (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Alles in Euro je Monat, alles freiwillig, alles NULLABLE.
  --
  -- `null` heisst „nicht angegeben", `0` heisst „gibt es nicht". Der
  -- Unterschied trägt die ganze Rechnung: Ohne ihn lässt sich nicht
  -- sagen, wie vollständig sie ist.
  wohnen           integer,
  energie          integer,
  versicherungen   integer,
  mobilitaet       integer,
  lebensmittel     integer,
  kredite          integer,
  abos             integer,
  kinder           integer,
  freizeit         integer,
  sparen           integer,
  sonstiges        integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Die aktuelle Stelle — als Vergleichsseite.
--
-- Ohne sie ist „lohnt sich der Wechsel" nicht beantwortbar: Man kann
-- den neuen Job ausrechnen und hat nichts, wogegen man ihn hält.
CREATE TABLE IF NOT EXISTS current_employment (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  job_title      text,
  company_name   text,
  -- Brutto, in der Währung des Vertrags.
  gross_amount   integer,
  currency       text NOT NULL DEFAULT 'EUR',
  salary_period  salary_period NOT NULL DEFAULT 'year',

  work_model     work_model,
  office_days_per_week integer,
  -- Einfache Wegstrecke in Minuten. Vom Menschen genannt, nicht
  -- gerechnet: Es gibt keinen Routingdienst.
  commute_minutes integer,
  commute_cost_month integer,

  started_at date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
