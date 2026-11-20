import { MODES } from '../public/shared.js';
// Card banks. This file stays on the server so students cannot read the answers in the page.
// One bank per game mode (see MODES in public/shared.js). In every card, c is the DESK SLOT letter:
//   fo : F = FACT,      O = OPINION
//   tb : F = TABLOID,   O = BROADSHEET
//   d1 : F = ALLITERATION, I = HYPERBOLE, L = PUN, O = QUESTION (rhetorical)
//   d2 : F = ALLUSION,  I = SLANG,        L = RHYME, O = STATS
// RULE FOR EVERY CARD: exactly ONE correct answer. Headline cards for the device modes use ONE device only.
// w: the very short reason shown after a delivery.

const mk = (c) => (t, w) => ({ t, c, w, lv: 1 });
const F = mk('F'), O = mk('O'), I = mk('I'), L = mk('L');

const FACT_OPINION = [
  // ---- facts: reports of what people said or found (the SAYING can be checked) ----
  F('The reporter said dogs are the worst pets.', 'Check the article: she did say it.'),
  F('The headteacher announced that homework is pointless.', 'It can be checked that he said it.'),
  F('Ms Ali told the class Macbeth is the greatest play.', 'Whether she said it can be checked.'),
  F('The mayor called the new park ugly in the paper.', 'Check the paper: those were her words.'),
  F('The article claimed school dinners are disgusting.', 'The article either claimed it or not.'),
  F('In our class vote, 18 of 30 pupils chose pizza.', 'Count the votes.'),
  F('A poll named summer the most popular season.', 'The poll result can be checked.'),
  F('A survey found 60% of pupils like maths.', 'The survey figure can be checked.'),
  F('The coach said we played badly on Saturday.', 'Check that the coach said it.'),
  F('The newspaper quoted a fan calling the referee useless.', 'Check the quote in the paper.'),
  // ---- facts that sound dramatic or judgemental but can be checked ----
  F('The council spent £2 million on the new library.', 'Council accounts can be checked.'),
  F('Rain fell on 18 days last March.', 'Weather records can be checked.'),
  F('The match finished 3-0 to the visitors.', 'The scoreboard shows it.'),
  F('More than 5,000 fans attended Saturday\'s match.', 'Attendance figures can be checked.'),
  F('The shop closed down last Friday.', 'You can check if it closed.'),
  F('The bridge is 120 metres long.', 'It can be measured.'),
  F('The shop raised its prices by 10% in May.', 'Price lists can be checked.'),
  F('The old cinema was demolished in 1998.', 'Council records give the date.'),
  F('The school canteen sells more pizza than salad.', 'Sales records can be checked.'),
  F('The firm cut 200 jobs this year.', 'Company figures can be checked.'),
  // ---- facts: science, geography, history (checkable and true) ----
  F('Cyprus joined the European Union in 2004.', 'Check official records.'),
  F('The first Moon landing took place in 1969.', 'History records give the date.'),
  F('Adult humans have 206 bones.', 'Count them: anatomy books confirm it.'),
  F('Russia covers more area than Canada.', 'Measure it: check an atlas.'),
  F('The Nile is longer than the Thames.', 'Rivers can be measured.'),
  F('Light travels faster than sound.', 'It has been measured.'),
  F('Venus is hotter than Mercury.', 'Surface temperatures were measured.'),
  F('The Titanic sank in 1912.', 'History records give the date.'),
  F('Sound cannot travel through a vacuum.', 'Experiments show it.'),
  F('Blue whales are the largest animals alive.', 'Scientists measured them.'),
  F('The Berlin Wall came down in 1989.', 'History records give the date.'),
  F('The angles of a triangle add up to 180 degrees.', 'You can prove it with a protractor.'),
  F('Olympus is the highest peak in Cyprus.', 'Surveyors measured it.'),
  F('A cheetah can run faster than a lion.', 'Speeds have been measured.'),
  F('Water is made of hydrogen and oxygen.', 'Chemists can check it.'),
  F('Mercury is the planet closest to the Sun.', 'Astronomers can check it.'),
  F('A World Cup is held every four years.', 'Check the tournament records.'),
  F('Tokyo has more people than Paris.', 'Census figures can be checked.'),
  // ---- facts that are checkable but FALSE (still facts: you can check them) ----
  F('Cyprus is bigger than Sicily.', 'Checkable, so a fact. (It is false.)'),
  F('Sharks are mammals.', 'Checkable, so a fact. (It is false.)'),
  F('Mount Everest is in Africa.', 'Checkable, so a fact. (It is false.)'),
  F('Spiders have six legs.', 'Checkable, so a fact. (It is false.)'),
  F('The Pacific is smaller than the Atlantic.', 'Checkable, so a fact. (It is false.)'),
  F('Everyone in our year got full marks in the test.', 'You can check the marks. (False.)'),

  // ---- opinions that hide a number or a fact (the judgement is what matters) ----
  O('99% of french fries taste bad.', "A number, but 'taste bad' is a feeling."),
  O('Nine out of ten films are boring.', "'Boring' is a feeling, whatever the number."),
  O('At 8,849 metres, Everest is the most impressive mountain.', "Height is fact, 'most impressive' is not."),
  O('London, home to nine million people, is the most exciting city.', "'Most exciting' is a judgement."),
  O("Football's ninety minutes are more thrilling than rugby's eighty.", "'More thrilling' is taste."),
  O('The film is three hours long, which makes it dull.', "Length is fact, 'dull' is a judgement."),
  O('At £12, the ticket is far too expensive.', "The price is fact, 'too expensive' is not."),
  O('The council was right to spend £2 million on the library.', "'Right to' is a judgement."),
  O('Seven lessons a day is far too many.', "'Too many' is a judgement."),
  O('A twelve-hour school day would be cruel.', "'Cruel' is a judgement."),
  O('The match ended 3-0, so the referee must have been biased.', "'Biased' is a view, not a score."),
  O('Cyprus has the most beautiful beaches in Europe.', "'Most beautiful' cannot be measured."),
  O('The 2022 World Cup final was the greatest match ever played.', "'Greatest' is a judgement."),
  O('Messi is the greatest footballer of all time.', "'Greatest' is a judgement."),
  // ---- opinions with 'obvious' or 'everyone knows' camouflage ----
  O('It is obvious that homework is useless.', "'Obvious' does not make it fact."),
  O('Macbeth is obviously the best play ever written.', "'Obviously best' is still a judgement."),
  O('Any sensible person would choose summer over winter.', 'A view dressed up as common sense.'),
  O('Clearly, the old cinema should never have been knocked down.', "'Should never' is a view."),
  // ---- opinions: 'should' and 'ought' ----
  O('Homework should be banned at weekends.', "'Should' says what someone wants."),
  O('Nobody under fourteen should have social media.', "'Should' says what someone wants."),
  O('The school should spend its money on a new pool.', "'Should' says what someone wants."),
  O('Every pupil ought to learn to code by age ten.', "'Ought to' says what someone wants."),
  O('Phones must be banned from classrooms.', "'Must be' is a demand, not a fact."),
  O('Break time should be twice as long.', "'Should' says what someone wants."),
  // ---- opinions: predictions nobody can check yet ----
  O('Our team will definitely win on Saturday.', 'A prediction cannot be checked yet.'),
  O('Electric cars will make petrol cars disappear.', 'A prediction cannot be checked yet.'),
  O('Robots will soon do most teachers\' jobs.', 'A prediction cannot be checked yet.'),
  O('Next year\'s exams will be harder than this year\'s.', 'A prediction cannot be checked yet.'),
  O('This film will win every award going.', 'A prediction cannot be checked yet.'),
  // ---- opinions: plain taste and judgement ----
  O('Dogs are the worst pets.', "'Worst' is a judgement."),
  O('The new library is an ugly building.', "'Ugly' is taste."),
  O('Latin is a pointless subject.', "'Pointless' is a judgement."),
  O('Spring is the most pleasant season.', "'Most pleasant' is taste."),
  O('The best way to revise is with music on.', "'Best way' is a view."),
  O('A ten-minute break is not long enough.', "'Not long enough' is a judgement."),
  O('Winter, with its short days, is the dreariest season.', "'Dreariest' is a feeling."),
  O('Pizza with three toppings is the perfect pizza.', "'Perfect' is taste."),
  O('The school canteen\'s pasta is the tastiest in town.', "'Tastiest' is taste."),
  O('Reading a paper is better than watching the news.', "'Better' is a view."),
  O('Macbeth is more gripping than Romeo and Juliet.', "'More gripping' is a judgement."),
  O('Saturday\'s match was the most boring of the season.', "'Most boring' is a feeling."),
];


// ---- TABLOID or BROADSHEET: judge the LANGUAGE and STYLE, never the topic ----
const TABLOID_BROADSHEET = [
  // tabloid: pun, alliteration, hyperbole, slang, exclamation, emotive words, rhetorical question
  F('SHOCK: Head teacher caught napping at assembly!', 'Emotive shock word and exclamation mark.'),
  F('Pizza Panic: Pupils Pelt Prefect!', 'Alliteration and an exclamation mark.'),
  F('Hamster Hero Escapes School Jail', 'Dramatic, playful word choice.'),
  F('Bus Fares Soar: Is Your Wallet Ready?', 'A rhetorical question to grab you.'),
  F('Fuel Madness Hits Drivers Again!', 'Emotive word and an exclamation mark.'),
  F('Bank Bosses Rake In Bumper Bonuses While You Pay!', 'Addresses the reader, emotive tone.'),
  F('Storm Slams Seaside: Sandcastles Wiped Out!', 'Dramatic verbs and an exclamation mark.'),
  F('Spud-tacular! Farmer Grows Giant Potato', 'A pun, plus an exclamation mark.'),
  F('Cheesed Off! Man Sues Shop Over Mouldy Brie', 'Pun and slang.'),
  F('Worst Landlord In Britain?', 'Exaggerating question to hook readers.'),
  F('Our Brave Boys Bring Home Cup Glory!', 'Emotive, patriotic, exclamation mark.'),
  F('Fury As Scandal-Hit MP Says Sorry... Again!', 'Emotive words and drama.'),
  F("You'll Never Guess What This Dog Did Next!", 'Talks to the reader, teases.'),
  F('Heatwave Havoc: Britain Sizzles In Scorcher!', 'Alliteration, slang, exclamation mark.'),
  F('Hospital Horror: Patients Wait Forever', 'Emotive and exaggerated.'),
  F('Dinner Lady Dishes Out Dramatic Quit Note', 'Alliteration and a pun.'),
  F('Council Goes Bin-Crazy As Residents Fume', 'Slang and emotive verbs.'),
  F('Super Gran Smashes Marathon Record!', 'Playful nickname and exclamation mark.'),
  F('Rail Fail Fury: Commuters Left Fuming', 'Rhyme and emotive words.'),
  F('Nightmare On Elm Street As Pothole Swallows Car!', 'A film allusion and drama.'),
  F('Love Rat Footballer Dumped By Telly Star', 'Slang and name-calling.'),
  F('Teen Wizard Wows Judges With Mind-Blowing Trick!', 'Hyperbole and an exclamation mark.'),
  F('Doom For Dolphins: Oil Spill Horror', 'Alliteration and emotive words.'),
  F('Mayor Splashes Cash On Statue Of Own Dog!', 'Cheeky tone and an exclamation mark.'),
  F('Taxi Terror: Driver Dumps Drunk Dad In Ditch', 'Alliteration and emotive words.'),
  F('Britain Freezes Solid In Big Chill Chaos!', 'Exaggeration and alliteration.'),
  F('Gran Wins Lottery And Buys Everyone Chips!', 'Chatty tone and exclamation mark.'),
  F('Pothole Pandemonium Plagues Plymouth', 'Heavy alliteration for effect.'),
  F('Tragic Tot Tumbles From Tree', 'Alliteration and an emotive word.'),
  F('Is This The Rudest Waiter On Earth?', 'Rhetorical question and exaggeration.'),
  F('Beast From The East Bites Back!', 'Dramatic nickname and an exclamation mark.'),
  F('Chip Shop Chaos As Chippy Runs Out Of Fish!', 'Alliteration, slang and exclamation.'),
  F('Cat-astrophe! Moggy Stuck Up Tree For A Week', 'A pun and slang.'),
  F('Footie Fans Go Bananas After Last-Gasp Winner', 'Slang and playful exaggeration.'),
  F('Eco Warriors Slam Fat Cat Bosses', 'Emotive, name-calling language.'),
  F('Unlucky Larry Loses Lottery Ticket Again!', 'Playful, emotive and exclamatory.'),
  F('Gran Gobsmacked By Giant Gas Bill', 'Slang and alliteration.'),
  // broadsheet: formal register, neutral, informative, numbers and attributions; some are about light topics on purpose
  O('Government announces review of secondary school funding', 'Formal, neutral and informative.'),
  O('Unemployment falls to 4.2% for third consecutive quarter', 'Factual, formal and precise.'),
  O('Scientists link rising sea temperatures to coral decline', 'Formal and informative; no tricks.'),
  O('Council approves £3m plan to repair ageing flood defences', 'Neutral, factual and detailed.'),
  O('Bank of England holds interest rates at 4.5%', 'A plain statement of fact.'),
  O('Temperatures reach 37C as health warnings are issued', 'Precise figure, calm tone.'),
  O('Opposition criticises proposed changes to planning laws', 'Formal vocabulary, no drama.'),
  O('Manufacturing output rises for second month, figures show', 'Informative, formal and sourced.'),
  O('University researchers develop faster test for rare disease', 'Formal, informative and long-form.'),
  O('Train operators to introduce new timetable from December', 'Plain and informative.'),
  O('Cyprus and Greece sign agreement on energy cooperation', 'Formal political reporting.'),
  O('Fewer young people are studying modern languages, study finds', 'Formal and attributed to a study.'),
  O('Minister defends decision to extend free school meals', 'Neutral reporting of a debate.'),
  O('National squad named for qualifying match in Lisbon', 'Formal sports reporting.'),
  O('Retail sales fall 0.6% as consumer confidence weakens', 'Precise numbers and formal words.'),
  O('Inquiry hears evidence on hospital waiting times', 'Neutral, formal wording.'),
  O('Local library to extend opening hours during exam season', 'Light topic, but plain and formal.'),
  O('Celebrity couple announce separation in joint statement', 'Gossip topic, but neutral formal wording.'),
  O('Town swimming pool to close for three weeks after burst pipe', 'Plain, factual and complete.'),
  O('Council to change bin collection days from March', 'Dull topic, plain formal wording.'),
  O('Heavy rain expected across the island on Thursday', 'Calm, informative forecast.'),
  O('Researchers question the accuracy of the latest poll', 'Formal verbs and measured tone.'),
  O('Parents consulted on plans for new primary school', 'Formal and informative.'),
  O('Prime minister meets union leaders to discuss pay dispute', 'Formal political reporting.'),
  O('Hospital reports record number of emergency admissions', 'Factual, serious wording.'),
  O('Museum acquires rare 17th-century manuscript', 'Plain, precise and formal.'),
  O('Exports to the EU rose by 3% last year, report says', 'Statistic plus a named source.'),
  O('Environment agency warns of flood risk along the river', 'Formal, measured warning.'),
  O('Football club appoints new manager on a three-year contract', 'Plain and detailed.'),
  O('Charity raises £12,000 for children\'s ward renovation', 'Factual with a precise sum.'),
  O('Pupils\' exam results improve across the region', 'Plain, formal and factual.'),
  O('New bus route to link village with town centre', 'Plain and informative.'),
  O('Pharmacists call for clearer labelling on medicines', 'Formal and attributed.'),
  O('Airline suspends flights to the capital until Monday', 'Calm and factual.'),
  O('Peace talks resume after two-week break', 'Formal and neutral.'),
];

// ---- DEVICES, set 1: ALLITERATION (F), HYPERBOLE (I), PUN (L), QUESTION (O). ONE device per headline. ----
const DEVICES_1 = [
  F('Pupils Prefer Pizza', 'Same first sound: P, P, P.'),
  F('Storm Strikes Stornoway', 'Repeated S sound.'),
  F('Cats Cause Chaos In Corridor', 'Repeated C sound.'),
  F('Bridge Builders Battle Bad Weather', 'Repeated B sound.'),
  F('Dancing Dogs Delight Dundee', 'Repeated D sound.'),
  F('Peter\'s Pet Python Pops Out', 'Repeated P sound.'),
  F('Cyprus Celebrates Cheese Competition', 'Repeated C sound.'),
  F('Lost Labrador Located Lakeside', 'Repeated L sound.'),
  F('Bakery Boss Bags Big Bonus', 'Repeated B sound.'),
  F('Wet Weekend Worries West Wales', 'Repeated W sound.'),
  F('Marvellous Mix-Up Muddles Mayor', 'Repeated M sound.'),
  F('Fresh Fruit Fans Flock To Farm', 'Repeated F sound.'),
  I('Unluckiest Man In The World Loses Keys Again', 'A huge exaggeration.'),
  I('Worst Winter Ever: Britain Freezes Solid', 'Deliberate exaggeration.'),
  I('Queue So Long It Reached The Moon', 'Impossible, so exaggeration.'),
  I('Footballer Eats Entire Supermarket For Lunch', 'Impossible, so exaggeration.'),
  I('Teachers Mark A Billion Books This Week', 'Wildly exaggerated.'),
  I('Biggest Cake On Earth Feeds The Whole World', 'Far beyond the truth.'),
  I('Traffic Jam Lasts A Thousand Years', 'Impossible, so exaggeration.'),
  I('Pupil Waits Forever For Bus', 'Exaggerates the wait.'),
  I('Heat So Fierce Pavements Melt Into Soup', 'Wild exaggeration.'),
  I('Homework Pile Reaches The Sky', 'Exaggerates the size.'),
  I('Everyone In Britain Loves This Chip Shop', 'Absurdly sweeping claim.'),
  I('Mum Says She Has Told Him A Million Times', 'Exaggerated number for effect.'),
  L('Baker Rises To The Occasion After Award', "'Rises' plays on bread and success."),
  L('Electrician Wins Shocking Victory', "'Shocking' plays on electricity."),
  L('Clock Factory Workers Run Out Of Time', 'Plays on clocks and time.'),
  L('Gardeners Dig Deep For Charity', "'Dig deep' plays on gardening."),
  L('Scarecrow Wins Prize For Being Outstanding In His Field', 'A joke on two meanings of field.'),
  L('Tailor Suits Up For Record Sale', "'Suits' plays on clothes."),
  L('Bakery Closes As Owner Kneads A Break', "'Kneads' sounds like needs."),
  L('Sheep Farmers Fleece Rivals At County Show', "'Fleece' has two meanings."),
  L('Fish Market Sells Out: Customers Are Hooked', "'Hooked' plays on fishing."),
  L('Cheesemaker\'s Fortunes Turn Out Gouda', "'Gouda' sounds like good."),
  L('Dentist Takes Drilling Job Seriously', "'Drilling' has two meanings."),
  L('Pencil Factory Closes: Staff Left Without A Point', "'Point' has two meanings."),
  O('Are Our High Streets Dying?', 'A question asked for effect.'),
  O('Has School Lunch Really Got Better?', 'A question not meant to be answered.'),
  O('Who Will Fix Our Broken Bus Routes?', 'A rhetorical question.'),
  O('Can Anyone Stop The Rising Price Of Bread?', 'Asked for effect.'),
  O('Is Homework Doing Any Good?', 'A rhetorical question.'),
  O('Why Is Nobody Listening To Teenagers?', 'Asked for effect, not for an answer.'),
  O('Will Our Team Ever Win Again?', 'A rhetorical question.'),
  O('Should Phones Be Banned From Schools?', 'A question put to the reader.'),
  O('What Happened To Our Local Cinema?', 'A question, not a statement.'),
  O('Is The Park Safe For Children?', 'A rhetorical question.'),
  O('Could This Be The End Of Cash?', 'A question asked for effect.'),
  O('Where Has All The Summer Gone?', 'A rhetorical question.'),
];

// ---- DEVICES, set 2: ALLUSION (F), SLANG (I), RHYME (L), STATS (O). ONE device per headline. ----
const DEVICES_2 = [
  F('Head Teacher Meets His Waterloo At Sports Day', 'Refers to Napoleon\'s famous defeat.'),
  F('Love Rat Ricky Is No Romeo', 'Refers to Shakespeare\'s lover.'),
  F('Mayor\'s Plan Is A Trojan Horse For Developers', 'Refers to the Greek myth.'),
  F('Council Fiddles While Park Burns', 'Refers to the story of Nero.'),
  F('Goliath Supermarket Faces Local David', 'Refers to the Bible story.'),
  F('Year 9 Hamlet Cannot Decide: To Resit Or Not?', 'Refers to Shakespeare\'s Hamlet.'),
  F('Achilles Heel Costs Team The Cup', 'Refers to the Greek hero.'),
  F('Pandora\'s Box Opened At Planning Meeting', 'Refers to the Greek myth.'),
  F('Teacher Plays Scrooge With Christmas Homework', 'Refers to Dickens\' Scrooge.'),
  F('Our Own Robin Hood Gives Rich Bakery The Slip', 'Refers to the outlaw legend.'),
  F('Midas Millionaire Turns Everything To Gold', 'Refers to the golden touch myth.'),
  F('Cinderella Cleaner Wins Gala Night Prize', 'Refers to the fairy tale.'),
  I('Gran Bags Bargain Telly In Charity Shop', "'Bags' and 'telly' are informal."),
  I('Fans Gutted As Match Called Off', "'Gutted' is informal slang."),
  I('Pupils Chuffed With Exam Results', "'Chuffed' is slang."),
  I('Teacher Loses The Plot At Sports Day', 'Informal expression.'),
  I('Mum Goes Bananas As Kids Chuck Fruit', 'Slang words.'),
  I('Bus Driver Legs It After Prank', "'Legs it' is slang."),
  I('Lads Pinch Chips From Chippy', "'Chippy' and 'pinch' are slang."),
  I('Gran Wins Fifty Quid And Treats The Street', "'Quid' is slang."),
  I('Head Gets In A Right Strop Over Hoodies', "'Strop' is informal."),
  I('Kids Nick Sweets From Corner Shop', "'Nick' is slang."),
  I('Footie Fans Cheesed Off With Ticket Prices', 'Informal words.'),
  L('Moggy In The Fog Rescued By Dog', 'Fog and dog rhyme.'),
  L('Teacher\'s Mule Breaks The School Rule', 'Mule and rule rhyme.'),
  L('Late Train Brings Pain On The Plain', 'Train, pain and plain rhyme.'),
  L('Fish Dish Wish Granted At Chip Shop', 'Fish, dish and wish rhyme.'),
  L('Mum\'s Gum Makes Bus Stop Glum', 'Mum, gum and glum rhyme.'),
  L('Snow Show Goes Ahead Despite The Blow', 'Snow, show and blow rhyme.'),
  L('Bake Sale Fail Leaves Cakes Stale', 'Sale, fail and stale rhyme.'),
  L('Dog\'s Jog Ends In A Bog', 'Dog, jog and bog rhyme.'),
  L('Clown In Town Gets Renown', 'Clown, town and renown rhyme.'),
  O('Separation Anxiety Affects 85% Of Dogs', 'Uses a percentage as evidence.'),
  O('Hottest Day Of The Year Hits 37C', 'Uses a measured figure.'),
  O('One In Four Pupils Walk To School', 'Uses a statistic.'),
  O('3,000 Fans Pack Stadium For Cup Final', 'Uses a number.'),
  O('School Raises £4,500 In Sponsored Silence', 'Uses a precise sum.'),
  O('Bus Fares Up 12% This Year', 'Uses a percentage.'),
  O('Library Loans Rise By A Third', 'Uses a fraction as evidence.'),
  O('Seven Out Of Ten Pupils Prefer Pizza', 'Uses a statistic.'),
  O('400 Odd Socks Found In Lost Property', 'Uses a precise number.'),
  O('Town Records 112 Millimetres Of Rain In One Day', 'Uses a measurement.'),
  O('Study Of 2,000 Teens Links Sleep To Grades', 'Uses sample size and numbers.'),
  O('Cyprus Welcomes Four Million Visitors', 'Uses a number.'),
];

export const BANKS = { fo: FACT_OPINION, tb: TABLOID_BROADSHEET, d1: DEVICES_1, d2: DEVICES_2 };
export const CARDS = FACT_OPINION;   // (kept for older tests)

// A small shuffled deck per desk so the same card does not come round twice in a row.
export class Deck {
  constructor(mode, rng) {
    this.rng = rng; this.mode = BANKS[mode] ? mode : 'fo'; this.piles = {};
    this.kinds = MODES[this.mode].kinds;
    this.weights = {}; for (const k of this.kinds) this.weights[k] = 1 / this.kinds.length;
    for (const k of this.kinds) this.piles[k] = [];
    this.recent = [];
  }
  refill(k) {
    const cards = BANKS[this.mode].map((c, i) => ({ ...c, id: i })).filter((c) => c.c === k);
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    this.piles[k] = cards;
  }
  draw() {
    // keep desks balanced: pick one at random, but never the same desk three times in a row
    let k;
    for (let tries = 0; tries < 8; tries++) {
      let r = this.rng(), acc = 0; k = this.kinds[0];
      for (const kk of this.kinds) { acc += this.weights[kk]; if (r <= acc) { k = kk; break; } }
      if (!(this.recent.length >= 2 && this.recent[0] === k && this.recent[1] === k)) break;
    }
    this.recent.unshift(k); this.recent.length = Math.min(this.recent.length, 2);
    if (!this.piles[k].length) this.refill(k);
    return this.piles[k].pop();
  }
}
