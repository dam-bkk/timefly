/** RFC-4180 CSV with a UTF-8 BOM so Excel opens it with the right encoding. */
const BOM = String.fromCharCode(0xfeff);

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}
