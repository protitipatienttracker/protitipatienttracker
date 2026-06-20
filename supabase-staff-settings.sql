-- STAFF TABLE
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  email text not null,
  status text check (status in ('Active', 'Inactive')) default 'Active',
  created_at timestamptz default now()
);

-- SETTINGS TABLE (key-value store for facility info, notification rules, etc.)
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table staff enable row level security;
alter table settings enable row level security;

-- Open policies (tighten later with auth)
create policy "Allow all" on staff for all using (true) with check (true);
create policy "Allow all" on settings for all using (true) with check (true);

-- SEED STAFF DATA
insert into staff (name, role, email, status) values
('Arjun Sathe', 'Psychiatrist', 'arjun.sathe@protiti.in', 'Active'),
('Dr. Rajan Pillai', 'Psychiatrist', 'rajan.pillai@caretrack.in', 'Active'),
('Dr. Anand Krishnan', 'Psychiatrist', 'anand.krishnan@caretrack.in', 'Active'),
('Dr. Pradeep Nair', 'Consultant', 'pradeep.nair@caretrack.in', 'Active'),
('Kavitha Menon', 'Clinical Coordinator', 'kavitha.menon@caretrack.in', 'Active'),
('Sujatha Varma', 'Admin Staff', 'sujatha.varma@caretrack.in', 'Inactive');

-- SEED DEFAULT SETTINGS
insert into settings (key, value) values
('facility_name', 'Serenity Mental Health Rehabilitation Centre'),
('facility_address', '42, Jubilee Hills, Hyderabad – 500033, Telangana'),
('facility_license', 'MH-RB-2019-4422'),
('facility_total_beds', '30'),
('notify_renewal', 'true'),
('notify_renewal_days_before', '7'),
('notify_assessment', 'true'),
('notify_minor_turning_18', 'true'),
('email_notifications', 'true'),
('whatsapp_notifications', 'false'),
('whatsapp_number', '');
