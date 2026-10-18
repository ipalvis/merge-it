/* How map.json is built (by scripts/build-map.mjs; not part of the game bundle): U.S. Census Bureau boundaries via
   us-atlas, already Albers-projected. The Lower 48 only. */

// FIPS code -> postal abbreviation, Lower 48 only
// prettier-ignore
const US_ABBR = { '01':'AL','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','12':'FL','13':'GA','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY' };

export default {
  topo: 'us-atlas/states-albers-10m.json',
  object: 'states',
  pick: g => (US_ABBR[g.id] ? { id: US_ABBR[g.id] } : null),
  keepIsland: 0.12, // islands smaller than this share of the main shape are dropped
};
