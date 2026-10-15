export const merchants = [
  ['moonpaper-studio', 'Moonpaper Studio', 'creative'],
  ['lantern-table', 'Lantern Table', 'food'],
  ['pixel-cove', 'Pixel Cove', 'gaming'],
  ['harbor-motion', 'Harbor Motion', 'sports'],
  ['little-comet', 'Little Comet', 'family'],
];

export const venues = [
  ['moonpaper-dha', 0, 'DHA', 'dha'], ['moonpaper-clifton', 0, 'Clifton', 'clifton'],
  ['lantern-pechs', 1, 'PECHS', 'pechs'], ['lantern-saddar', 1, 'Saddar', 'saddar'],
  ['pixel-gulshan', 2, 'Gulshan', 'gulshan'], ['pixel-bahadurabad', 2, 'Bahadurabad', 'bahadurabad'],
  ['harbor-north', 3, 'North Nazimabad', 'north-nazimabad'], ['comet-malir', 4, 'Malir', 'malir'],
];

// slug, venue index, category, PKR price, max group, vibe
export const experiences = [
  ['watercolor-evening',0,'creative',1800,8,'creative'], ['clay-and-tea',0,'creative',3200,6,'date-night'],
  ['postcard-workshop',1,'creative',1200,12,'family'], ['table-for-two',2,'food-drink',4500,2,'date-night'],
  ['tasting-flight',2,'food-drink',2600,4,'chill'], ['street-food-story',3,'food-drink',1500,8,'friends'],
  ['retro-arcade-hour',4,'gaming',900,6,'friends'], ['team-console-night',4,'gaming',2200,8,'indoor'],
  ['puzzle-room',5,'gaming',3800,6,'adventurous'], ['board-game-brunch',5,'gaming',1700,6,'family'],
  ['beginner-badminton',6,'sports',1400,4,'adventurous'], ['weekend-mini-tournament',6,'sports',2800,12,'friends'],
  ['family-craft-hour',7,'creative',1000,8,'family'], ['little-explorers',7,'entertainment',1900,10,'family'],
  ['quiet-reading-hour',1,'wellness',700,2,'chill'],
];

// slug, experience index, original price, drop price, claim limit
export const drops = [
  ['watercolor-pass',0,1800,1250,20], ['clay-pair-pass',1,3200,2400,10],
  ['postcard-pass',2,1200,850,30], ['tasting-pass',4,2600,1900,12],
  ['arcade-pass',6,900,650,25], ['puzzle-pass',8,3800,2900,8],
  ['badminton-pass',10,1400,1000,16], ['craft-pass',12,1000,700,24],
];

export const slug = value => `demo-khi-${value}`;
