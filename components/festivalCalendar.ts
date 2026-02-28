/**
 * Smart Festival Calendar — state-aware upcoming events for merchant dashboard.
 *
 * - National festivals (states: 'all') appear for every merchant
 * - Regional festivals appear only for merchants whose store is in a matching state
 * - Dates are for 2026; update annually for lunar-calendar festivals
 */

export interface FestivalEvent {
  name: string;
  date: string;           // 'YYYY-MM-DD'
  emoji: string;
  themeKey: string;       // Maps to CSS banner classes in index.css
  states: 'all' | string[];
  dealHint: string;       // 1-line deal suggestion for merchant
}

// ─── 2026 Calendar ───
// Sources: timeanddate.com/holidays/india/2026, drikpanchang.com
// Lunar-calendar dates shift each year — update before Jan 1 each year.

const FESTIVAL_CALENDAR: FestivalEvent[] = [
  // ── January ──
  { name: 'New Year',           date: '2026-01-01', emoji: '🎉', themeKey: 'defaultBlue',    states: 'all', dealHint: 'New year sale & clearance deals' },
  { name: 'Lohri',              date: '2026-01-13', emoji: '🔥', themeKey: 'defaultBlue',    states: ['Punjab', 'Haryana', 'Delhi', 'Himachal Pradesh'], dealHint: 'Winter warmth specials & combos' },
  { name: 'Pongal',             date: '2026-01-14', emoji: '🌾', themeKey: 'defaultBlue',    states: ['Tamil Nadu'], dealHint: 'Harvest festival offers & gift packs' },
  { name: 'Makar Sankranti',    date: '2026-01-14', emoji: '🪁', themeKey: 'defaultBlue',    states: ['Maharashtra', 'Gujarat', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Rajasthan', 'Madhya Pradesh', 'Uttar Pradesh', 'Bihar'], dealHint: 'Til-gul season discounts & festive deals' },
  { name: 'Republic Day',       date: '2026-01-26', emoji: '🇮🇳', themeKey: 'indianFlag',    states: 'all', dealHint: 'Patriotic sale — freedom deals' },

  // ── February ──
  { name: "Valentine's Day",    date: '2026-02-14', emoji: '❤️', themeKey: 'defaultBlue',    states: 'all', dealHint: 'Couples specials & gift combos' },
  { name: 'Maha Shivaratri',    date: '2026-02-15', emoji: '🔱', themeKey: 'defaultBlue',    states: 'all', dealHint: 'Devotional specials & night offers' },

  // ── March ──
  { name: 'Holi',               date: '2026-03-04', emoji: '🎨', themeKey: 'holiColors',     states: 'all', dealHint: 'Colorful festive deals & party packs' },
  { name: "Women's Day",        date: '2026-03-08', emoji: '👩', themeKey: 'defaultBlue',    states: 'all', dealHint: 'Special offers for women customers' },
  { name: 'Ugadi',              date: '2026-03-19', emoji: '🏮', themeKey: 'defaultBlue',    states: ['Karnataka', 'Andhra Pradesh', 'Telangana'], dealHint: 'New year festive deals & sweets' },
  { name: 'Gudi Padwa',         date: '2026-03-19', emoji: '🚩', themeKey: 'defaultBlue',    states: ['Maharashtra', 'Goa'], dealHint: 'Marathi new year offers & gold deals' },
  { name: 'Ram Navami',         date: '2026-03-26', emoji: '🙏', themeKey: 'defaultBlue',    states: 'all', dealHint: 'Devotional season specials' },
  { name: 'Eid al-Fitr',        date: '2026-03-30', emoji: '🌙', themeKey: 'defaultBlue',    states: 'all', dealHint: 'Eid mubarak deals & gift hampers' },

  // ── April ──
  { name: 'Baisakhi',           date: '2026-04-14', emoji: '🌾', themeKey: 'defaultBlue',    states: ['Punjab', 'Haryana'], dealHint: 'Harvest festival specials' },
  { name: 'Vishu',              date: '2026-04-14', emoji: '🌼', themeKey: 'defaultBlue',    states: ['Kerala'], dealHint: 'Kerala new year offers & Vishu kani deals' },
  { name: 'Bihu',               date: '2026-04-14', emoji: '🎶', themeKey: 'defaultBlue',    states: ['Assam'], dealHint: 'Rongali Bihu festive offers' },

  // ── May ──
  { name: "Mother's Day",       date: '2026-05-10', emoji: '💐', themeKey: 'defaultBlue',    states: 'all', dealHint: 'Gift ideas & special treats for moms' },

  // ── June ──
  { name: "Father's Day",       date: '2026-06-21', emoji: '👔', themeKey: 'defaultBlue',    states: 'all', dealHint: 'Gifts for dad — special combos & offers' },

  // ── August ──
  { name: 'Independence Day',   date: '2026-08-15', emoji: '🇮🇳', themeKey: 'indianFlag',    states: 'all', dealHint: 'Freedom sale — independence day deals' },
  { name: 'Onam',               date: '2026-08-26', emoji: '🐍', themeKey: 'defaultBlue',    states: ['Kerala'], dealHint: 'Onam sadhya deals & Kerala specials' },
  { name: 'Raksha Bandhan',     date: '2026-08-28', emoji: '🧵', themeKey: 'defaultBlue',    states: 'all', dealHint: 'Rakhi gifts & sibling combo offers' },

  // ── September ──
  { name: 'Janmashtami',        date: '2026-09-04', emoji: '🍯', themeKey: 'defaultBlue',    states: 'all', dealHint: 'Krishna Jayanti sweets & offers' },
  { name: 'Ganesh Chaturthi',   date: '2026-09-14', emoji: '🐘', themeKey: 'defaultBlue',    states: ['Maharashtra', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Goa'], dealHint: 'Ganpati specials & modak season deals' },

  // ── October ──
  { name: 'Gandhi Jayanti',     date: '2026-10-02', emoji: '🕊️', themeKey: 'indianFlag',    states: 'all', dealHint: 'Swadeshi specials & local brand deals' },
  { name: 'Navratri',           date: '2026-10-11', emoji: '💃', themeKey: 'diwaliColors',   states: 'all', dealHint: '9-night festive shopping deals' },
  { name: 'Durga Puja',         date: '2026-10-17', emoji: '🦁', themeKey: 'diwaliColors',   states: ['West Bengal', 'Odisha', 'Assam', 'Tripura', 'Bihar'], dealHint: 'Pujo season specials & pandal deals' },
  { name: 'Dussehra',           date: '2026-10-20', emoji: '🏹', themeKey: 'diwaliColors',   states: 'all', dealHint: 'Victory sale — Dussehra mega deals' },

  // ── November ──
  { name: 'Diwali',             date: '2026-11-08', emoji: '🪔', themeKey: 'diwaliColors',   states: 'all', dealHint: 'Festival of lights — biggest sale of the year' },
  { name: 'Chhath Puja',        date: '2026-11-15', emoji: '🌅', themeKey: 'defaultBlue',    states: ['Bihar', 'Jharkhand', 'Uttar Pradesh', 'Delhi'], dealHint: 'Chhath specials & pooja essentials' },
  { name: 'Guru Nanak Jayanti', date: '2026-11-24', emoji: '🙏', themeKey: 'defaultBlue',    states: ['Punjab', 'Haryana', 'Delhi'], dealHint: 'Gurpurab specials & community offers' },

  // ── December ──
  { name: 'Christmas',          date: '2026-12-25', emoji: '🎄', themeKey: 'christmasColors', states: 'all', dealHint: 'Holiday season gifts & year-end sale' },
];

/**
 * Returns upcoming festivals within `maxDays`, filtered by merchant's store states.
 * Falls back to the single nearest event if nothing is within the window.
 */
export function getUpcomingFestivals(
  merchantStates: string[],
  maxDays = 20,
  maxCount = 3
): FestivalEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Normalize merchant states to lowercase for case-insensitive matching
  const normalizedStates = merchantStates.map(s => s.toLowerCase().trim());

  const withDays = FESTIVAL_CALENDAR
    .map(f => {
      const festDate = new Date(f.date + 'T00:00:00');
      let diff = Math.ceil((festDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      // Wrap around for past dates (next year's occurrence)
      if (diff < 0) {
        const nextYear = new Date(festDate);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        diff = Math.ceil((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
      return { ...f, daysUntil: diff };
    })
    .filter(f => {
      // State filter: 'all' matches everyone, otherwise check intersection
      if (f.states !== 'all') {
        const festStates = f.states.map(s => s.toLowerCase().trim());
        if (!normalizedStates.some(ms => festStates.includes(ms))) return false;
      }
      return true;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // Get events within the window
  const inWindow = withDays.filter(f => f.daysUntil >= 0 && f.daysUntil <= maxDays);

  if (inWindow.length > 0) {
    return inWindow.slice(0, maxCount);
  }

  // Fallback: show the single nearest upcoming event
  const nearest = withDays.find(f => f.daysUntil >= 0);
  return nearest ? [nearest] : [];
}

/**
 * Utility: get days until a specific festival date string.
 */
export function getDaysUntilDate(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const festDate = new Date(dateStr + 'T00:00:00');
  let diff = Math.ceil((festDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) {
    const nextYear = new Date(festDate);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    diff = Math.ceil((nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
  return diff;
}
