const CATEGORIES = [
  { id: 'amigurumi', label: 'Amigurumi & Toys', re: /amigurumi|plush|stuff(ed|ie)|softie|\btoys?\b|\bdolls?\b|teddy|lovey|\b(bunny|bunnies|bears?|elephant|giraffe|camel|whale|octopus|dino(saur)?s?|dragons?|unicorns?|axolotls?|frogs?|turtles?|owls?|foxe?s?|lions?|monkeys?|penguins?|manatee|sloth|snails?|bees?|ladybugs?|mouse|mice|chicks?|ducks?|lamb|sheep|pigs?|cows?|seals?|sharks?|jellyfish|mushrooms?)\b/i },
  { id: 'blankets', label: 'Blankets & Afghans', re: /blanket|afghan|\bthrow\b|lapghan|\bquilt/i },
  { id: 'squares', label: 'Granny Squares & Motifs', re: /granny|\bsquares?\b|hexagon|\bhexi|motif|\bblock\b/i },
  { id: 'hats', label: 'Hats & Headwear', re: /\bhats?\b|beanie|beret|bonnet|balaclava|headband|ear ?warmer|\bcap\b|\bhood\b/i },
  { id: 'scarves', label: 'Scarves & Shawls', re: /scarf|scarves|cowl|shawl|\bwrap\b|snood|infinity/i },
  { id: 'tops', label: 'Sweaters & Tops', re: /sweater|cardigan|\btops?\b|\btee\b|\bvest\b|pullover|poncho|\btank\b|shrug|jumper|bralette|\bdress\b|(?<!tree )skirt|tunic|kimono|hoodie|jacket|\bcoat\b/i },
  { id: 'bags', label: 'Bags & Purses', re: /\bbags?\b|tote|purse|pouch|clutch|backpack|wallet/i },
  { id: 'home', label: 'Home Decor', re: /pillow|cushion|\brugs?\b|basket|coaster|placemat|table runner|garland|wall hanging|\bplant|curtain|bunting|doil(y|ies)|decor|ornament|wreath|bookmark|tree skirt|christmas tree/i },
  { id: 'kitchen', label: 'Dishcloths & Kitchen', re: /dish ?cloth|wash ?cloth|scrubb(y|ies|er)|pot ?holder|hot pad|\btowel|trivet|\b(mug|cup|tea|coffee|jar|can|bottle) coz(y|ies)\b|\bkitchen\b/i },
  { id: 'accessories', label: 'Accessories', re: /mittens?|gloves?|\bsocks?\b|slippers?|booties|leg ?warmers?|scrunchie|earrings?|necklace|bracelet|jewel(le)?ry|key ?chain|\bbows?\b|hair ?clip|bandana|\bbelt\b|fingerless/i },
  { id: 'baby', label: 'Baby & Kids', re: /\bbaby\b|babies|newborn|toddler|\bkids?\b|children|child'?s|infant/i },
  { id: 'pets', label: 'For Pets', re: /\bpets?\b|\b(dog|cat|puppy|kitty)\s+(sweater|bed|toy|coat|bandana|collar|cave)|for (dogs|cats)/i },
  { id: 'holiday', label: 'Holiday & Seasonal', re: /christmas|halloween|thanksgiving|easter|valentine|pumpkin|ornament|santa|snowm[ae]n|holiday|\bfall\b|autumn|spring|winter|summer|st\.? patrick|4th of july|\bghosts?\b|witch|skull|reindeer|gingerbread|stocking|hanukkah|gnome/i },
];

const ROUNDUP = /^\s*(top |the |over )?\d+\+?\s.*\b(patterns|ideas|designs|projects)\b|round-?up|\bcollection\b|best .*patterns/i;
const TUTORIAL = /how to|\btips\b|tutorial|\bstitch(es)?\b|technique|\blearn|guide to|beginner'?s guide/i;
const NOT_PATTERN = /giveaway|\bsale\b|discount|coupon|podcast|interview|gift guide|book review|yarn review|unboxing|\bwinners?\b|black friday|cyber monday|\bnews\b|announc/i;
const CROCHET = /crochet|amigurumi|granny|tunisian|\bcal\b/i;
const BEGINNER = /beginner|\beasy\b|simple|\bquick\b|one[- ]hour|1[- ]hour|no[- ]sew|first project/i;

function classify(title, excerpt, link) {
  const hay = `${title} ${excerpt}`;
  if (!CROCHET.test(`${hay} ${link}`)) return null;
  if (/knit/i.test(title) && !/crochet/i.test(title)) return null;
  if (NOT_PATTERN.test(title)) return null;

  let type;
  if (ROUNDUP.test(title)) type = 'roundup';
  else if (/pattern/i.test(title)) type = 'pattern';
  else if (TUTORIAL.test(title)) type = 'tutorial';
  else if (/\b(learn|did|why|what)\b.*\?$/i.test(title)) return null;
  else if (/\bfree\b|\bcal\b|crochet[- ]?along/i.test(title) || /pattern/i.test(excerpt)) type = 'pattern';
  else return null;

  let categories = CATEGORIES.filter((c) => c.re.test(title)).map((c) => c.id);
  if (!categories.length) categories = CATEGORIES.filter((c) => c.re.test(excerpt)).map((c) => c.id).slice(0, 2);

  return { type, categories, beginner: BEGINNER.test(hay) };
}

module.exports = { classify, CATEGORIES: CATEGORIES.map(({ id, label }) => ({ id, label })) };
