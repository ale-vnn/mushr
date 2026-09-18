/**
 * The two things every renderer here needs: escaping, and numbers.
 */

/**
 * Escape a value for insertion into an HTML string.
 *
 * The modules build HTML as strings, and not every value they receive is the
 * application's own — a forest name comes from the ONF inventory.
 */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * A number written the way the current language writes one, with a
 * non-breaking space before the unit so a value never wraps away from what it
 * measures.
 *
 * `toFixed` always writes a decimal point, which is wrong in French. The
 * separator below is a literal U+00A0: do not "tidy" it into a plain space.
 */
export const num = (value, digits = 1, unit = "", locale = "fr-FR") =>
  value == null
    ? "—"
    : value.toLocaleString(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }) + (unit ? ` ${unit}` : "");
