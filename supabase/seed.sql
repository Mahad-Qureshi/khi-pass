-- Optional reference-only seed. Not an automatic production migration. DO NOT APPLY in this task.
-- No auth users, merchant memberships, business partnerships, passes or votes are seeded.
begin;
insert into public.areas(name,slug,sort_order) values
 ('DHA','dha',10),('Clifton','clifton',20),('PECHS','pechs',30),('Bahadurabad','bahadurabad',40),
 ('Gulshan','gulshan',50),('North Nazimabad','north-nazimabad',60),('FB Area','fb-area',70),
 ('Malir','malir',80),('Saddar','saddar',90),('Shahrah-e-Faisal','shahrah-e-faisal',100)
on conflict(slug) do nothing;
insert into public.categories(name,slug,sort_order) values
 ('Food & Drink','food-drink',10),('Gaming','gaming',20),('Sports','sports',30),('Movies','movies',40),
 ('Shopping','shopping',50),('Creative','creative',60),('Events','events',70),('Outdoor','outdoor',80),
 ('Entertainment','entertainment',90),('Wellness','wellness',100)
on conflict(slug) do nothing;
insert into public.vibes(name,slug,sort_order) values
 ('Chill','chill',10),('Date Night','date-night',20),('Friends','friends',30),('Family','family',40),
 ('Adventurous','adventurous',50),('Creative','creative',60),('Indoor','indoor',70),('Outdoor','outdoor',80)
on conflict(slug) do nothing;
commit;
