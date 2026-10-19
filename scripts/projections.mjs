/* Map projections for level recipes (src/levels/<key>/source.mjs) whose boundary data is in longitude/latitude. */

/* Lambert azimuthal equal-area, spherical, centred on (lon0, lat0): areas stay true, and shapes are good near the
   centre. Returns [lon, lat] -> [x, y] in map px, y down so north is up on screen. A scale of 1000 is about the U.S.
   data's pixel size for a map the size of Europe, so the build script's simplification tolerances work. */
export function laea(lon0, lat0, scale = 1000) {
  const r = Math.PI / 180,
    p0 = lat0 * r;
  return ([lon, lat]) => {
    const l = (lon - lon0) * r,
      p = lat * r;
    const k = Math.sqrt(2 / (1 + Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)));
    return [
      scale * k * Math.cos(p) * Math.sin(l),
      -scale * k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)),
    ];
  };
}
