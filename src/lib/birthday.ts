/** Anniversaire saisi (« 2026-03-14 », « 14/03 », « 14/03/1990 », « 03-14 ») → « MM-JJ », sinon null. Pur. */
export function birthdayKey(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let month: number, day: number;
  if (m) {
    month = Number(m[2]);
    day = Number(m[3]);
  } else if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/))) {
    day = Number(m[1]);
    month = Number(m[2]);
  } else if ((m = s.match(/^(\d{1,2})-(\d{1,2})$/))) {
    month = Number(m[1]);
    day = Number(m[2]);
  } else return null;
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!max || day < 1 || day > max) return null;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const birthdayLabel = (key: string | null | undefined) => {
  if (!key) return "";
  const [m, d] = key.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
};
