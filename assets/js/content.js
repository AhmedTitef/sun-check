// Default coach content. The rep can edit every line on her phone so it matches
// her own training; edits are stored on the phone and these stay as the reset point.
// [company] and [store] stay as placeholders until the manager OKs naming them.

export const OPENERS = [
  { id: 'o1', line: 'Want to see your house from above? Takes ten seconds.', why: 'Curiosity beats a pitch. Everyone wants to see their own roof, and you are asking for ten seconds, not a meeting.' },
  { id: 'o2', line: 'How\'d your Edison bill treat you this summer?', why: 'Everyone in Edison country has a summer bill story, and the question makes no claim. Don\'t ask how much their bill is right away; shoppers say that turns them off.' },
  { id: 'o3', line: 'Is your power through Edison or the city?', why: 'Easy to answer while walking, and it sorts Edison homes from Riverside and the other city utilities. Then offer to show their roof.' },
  { id: 'o4', line: 'Do you own your place around here? I\'m showing folks how much sun their roof gets.', why: 'It checks ownership in the first sentence, and "how much sun" is a question about their house, not a product.' },
  { id: 'o5', line: 'Got a pool, an EV or a big AC? Those are the bills people ask me about most.', why: 'Big-usage homes are the best fits. Naming the appliance makes it about them.' },
  { id: 'o6', line: 'Have you heard what changed with solar this year? Most people haven\'t.', why: 'The tax credit change is real news and confusing. Only use it if you can explain it in one line (see "Didn\'t the tax credit end?").' },
  { id: 'o7', line: 'Which city are you in? I\'ll pull up your roof on the screen.', why: 'Easy to answer while walking. The city leads to the address, and the tablet does the rest.' },
  { id: 'o8', line: '¿Quiere ver su casa desde arriba? Solo toma diez segundos.', why: 'About 45% of Riverside and San Bernardino county residents speak a language other than English at home. Use it only if you can keep going in Spanish or bring in a teammate who can.' },
];

export const ANSWERS = [
  { id: 'rent', label: 'I rent', say: 'No problem at all! If you know someone who owns, this works for whoever scans it.', next: 'Often a polite way out. Smile, show your code or hand a friend card, and let them go. Renters don\'t go on the maybe list.' },
  { id: 'spouse', label: 'Ask my spouse', say: 'Totally fair, it\'s a decision for both of you. Let\'s pick a time that works, and it\'s great if your partner can join.', next: 'Invite the partner; don\'t demand it. Some shoppers hear "both must be there" as a pressure tactic. Not ready? Add them as a maybe so they get a link to look at together tonight.' },
  { id: 'cost', label: 'How much?', say: 'It depends on your roof and your bill, so I won\'t guess. You can buy, lease or pay monthly, and the consultant shows your exact numbers. Meeting them costs nothing.', next: 'Then ask how their summer bills have been. Check with your manager that the consultation is free before you say it.' },
  { id: 'credit', label: 'Tax credit ended?', say: 'For buying, yes. The homeowner credit ended for systems finished after 2025. With a lease or monthly plan, the company that owns the panels can still use a business credit, and the consultant shows what that means for you.', next: 'Don\'t quote percentages or dates beyond this. The consultant has the current terms.' },
  { id: 'moving', label: 'Moving / selling', say: 'Good to know. How soon? If it\'s a few years out, ask the consultant what happens with solar when you sell, because each option handles it differently.', next: 'Moving within a year? Thank them and let them go.' },
  { id: 'roof', label: 'Old roof', say: 'Good catch, roof age matters. The consultant checks the roof first and tells you straight if it should be redone before solar.', next: '' },
  { id: 'hoa', label: 'My HOA', say: 'California law stops HOAs from banning solar, though they can set reasonable rules. The consultant can walk you through what your HOA needs.', next: 'If it sounds like a polite way out, let them go.' },
  { id: 'scam', label: 'Solar is a scam', say: 'I hear that a lot, and there are bad actors out there. That\'s why today is just a look at your real numbers. Nothing to sign, and you can ask the consultant anything.', next: 'Never argue. Agree that being careful is smart.' },
  { id: 'store', label: 'Are you with the store?', say: 'I\'m with [company]. I don\'t work for [store]; we\'re the solar company here in the store. I set up the appointments, and a consultant shows you the numbers.', next: 'Say who you\'re with early. Shoppers complain most about solar reps who look like store staff.' },
  { id: 'no', label: 'Not interested', say: 'No worries at all. Here\'s a card in case your bill ever surprises you. It shows your own roof, on your phone, whenever you want.', next: 'Hand over the no-time card, smile and let them go. No pushing.' },
  { id: 'battery', label: 'Batteries / outages', say: 'Panels alone shut off in an outage for safety. A battery keeps the important things running and lets you use your own power in the 4 to 9 PM peak. The consultant can show both.', next: '' },
  { id: 'check', label: 'Credit check?', say: 'Booking a time doesn\'t check anything. Some plans need a credit check later, and the consultant tells you before anything is run.', next: 'Match this to your training. Don\'t guess at score cutoffs.' },
  { id: 'have', label: 'Already have solar', say: 'Nice! How\'s it working for you? If you ever want a battery, the consultant can look at that too.', next: 'Often a polite way out. Thank them and let them go.' },
  { id: 'hurry', label: 'In a hurry', say: 'Totally get it. Scan this and you can see your roof tonight on your phone and pick a time that works.', next: 'No-time card. Don\'t chase.' },
  { id: 'info', label: 'Send me info', say: 'Sure. This card shows your own roof, not a brochure. Or I can text you the link, if you\'d like.', next: 'Want a text? Add them to the maybe list and let them tick the OK-to-text box themselves.' },
  { id: 'lowbill', label: 'My bill is low', say: 'That\'s great. Then you may not need solar at all. Have a good one!', next: 'Low bills make weak appointments. A friendly goodbye is the right answer.' },
  { id: 'lease', label: 'Leases are bad', say: 'Fair question. You can buy, lease or pay monthly, and the consultant shows them side by side. You pick what fits, or nothing at all.', next: '' },
  { id: 'nem', label: 'NEM 3.0 killed solar', say: 'It changed the math. Power you send back to Edison earns a lot less now, so systems are built to use more of your own power, often with a battery for the 4 to 9 PM peak. The consultant shows whether it works for your house.', next: '' },
  { id: 'free', label: 'Is it free?', say: 'No, solar isn\'t free, and be careful with anyone who says it is. Meeting the consultant costs nothing, and they show the real costs for your home.', next: 'Never say "free solar" or "government program".' },
  { id: 'phone', label: 'Can we do it by phone?', say: 'Yes. The consultant can meet by phone or video, evenings and weekends too.', next: '' },
  { id: 'sell', label: 'What if I sell my house?', say: 'You\'ve got options. Usually it just transfers to the buyer: [company] has a team that handles the paperwork, and the buyer does a quick soft credit check. Or you can prepay the rest, so the buyer simply gets the power. The consultant walks you through it.', next: 'From the company\'s own home-selling pages. No guarantees about how fast a sale goes.' },
  { id: 'zero', label: 'Will my bill go to zero?', say: 'No. Edison\'s monthly fixed charge stays even with solar. The consultant shows what your bill would look like.', next: 'Never promise a zero bill.' },
  { id: 'north', label: 'My house faces north', say: 'You can often still go solar. Most roofs have more than one side, and panels go on the sides that get the most sun. The design on the tablet shows exactly where.', next: '' },
  { id: 'front', label: 'No panels on the front', say: 'Totally fine. Tell the consultant and they will design for the back or sides. If those get less sun, they will show you the difference.', next: 'The page asks this too, and it shows up in their request.' },
  { id: 'reviews', label: 'Heard bad things about you', say: 'That\'s fair to ask. Every big company has some unhappy customers. Read the reviews, ask the consultant anything, and decide for yourself. Today is just a look at your numbers.', next: 'Never trash-talk a competitor.' },
];

// Reasons a "maybe" gives, used to pick the right follow-up text.
export const TAGS = [
  { id: 'spouse', label: 'Spouse decides' },
  { id: 'cost', label: 'Cost' },
  { id: 'credit', label: 'Tax credit' },
  { id: 'roof', label: 'Old roof' },
  { id: 'hoa', label: 'HOA' },
  { id: 'moving', label: 'Might move' },
  { id: 'bill', label: 'Big bill' },
  { id: 'busy', label: 'No time' },
];

export const PRACTICE_PROMPT = (openers, answers) => `You are playing a busy shopper in a home-improvement store in the Inland Empire, Southern California. I am a solar appointment setter at a booth in the store. Help me practice by talking to me out loud.

How to play:
- Be a real shopper, not a salesperson. Short answers, a little distracted, sometimes skeptical.
- Each round, quietly pick a new shopper: homeowner or renter, age 25 to 75, with or without a spouse, an Edison (SCE) customer whose summer bill is somewhere from $120 to $450. Sometimes speak Spanish first.
- I'll open with one line. If it's weak, keep walking. If it's good, slow down and talk.
- Throw two to four of these at me, one at a time, when they'd come up naturally: ${answers.map(a => `"${a.label}"`).join(', ')}.
- Don't make it easy. If I promise savings, say anything is free, mention a government program, or act like I work for the store, call it out right away.
- The round ends when I book a time (you give me a day and time), when I get a "maybe" (you agree to a text), or when you walk off.
- After each round, step out of character for under 30 seconds: one thing I did well, one thing to fix, and one better line I could have said.
- Then start a new round with a different shopper.

Openers I'm testing: ${openers.map(o => `"${o.line}"`).join(' / ')}.

Start now. You're walking past my booth with a cart.`;

// Follow-up schedule for a "maybe": day offsets from when they said maybe.
export const CADENCE = [0, 2, 7, 14, 30, 56];
