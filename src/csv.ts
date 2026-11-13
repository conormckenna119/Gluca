import { Reading } from "./types";
import { normalize } from "./analytics";
function cells(line: string, delimiter: string) {
  const out: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      out.push(value.trim());
      value = "";
    } else value += c;
  }
  out.push(value.trim());
  return out;
}
export function parseCsv(
  text: string,
  dateOrder: "MDY" | "DMY" = "MDY",
  offset = "-05:00",
) {
  if (!/^[+-]\d{2}:\d{2}$/.test(offset))
    throw new Error(
      "Use a UTC offset such as -05:00. Split files at daylight-saving transitions.",
    );
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  const headerIndex = lines.findIndex(
    (l) =>
      /timestamp|time stamp|device timestamp/i.test(l) && /glucose/i.test(l),
  );
  if (headerIndex < 0)
    throw new Error("No timestamp and glucose header found.");
  const delimiter = lines[headerIndex].includes(";") ? ";" : ",";
  const header = cells(lines[headerIndex], delimiter);
  const ti = header.findIndex((c) => /timestamp|time stamp/i.test(c));
  const gi = header.findIndex((c) =>
    /glucose.*(mg|mmol)|^(glucose|value)$/i.test(c),
  );
  if (gi < 0)
    throw new Error(
      "Select a CSV with a glucose value column including its unit.",
    );
  const mmol = /mmol/i.test(header[gi]);
  if (!mmol && !/mg/i.test(header[gi]))
    throw new Error(
      "Unknown glucose units; add mg/dL or mmol/L to the glucose header.",
    );
  const rows: Reading[] = [];
  const errors: string[] = [];
  lines.slice(headerIndex + 1).forEach((line, index) => {
    const c = cells(line, delimiter);
    if (!c[gi]) return;
    let stamp = c[ti] ?? "";
    const local = stamp.match(
      /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})[ T](\d{1,2}:\d{2}(?::\d{2})?)$/,
    );
    if (local) {
      const a = local[1].padStart(2, "0"),
        b = local[2].padStart(2, "0");
      stamp = `${local[3]}-${dateOrder === "MDY" ? a : b}-${dateOrder === "MDY" ? b : a}T${local[4].padStart(5, "0")}${offset}`;
    } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(stamp))
      stamp = stamp.replace(" ", "T") + offset;
    const iso = stamp.match(
      /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/,
    );
    const calendarValid =
      iso &&
      Number(iso[2]) >= 1 &&
      Number(iso[2]) <= 12 &&
      Number(iso[3]) >= 1 &&
      Number(iso[3]) <=
        new Date(Date.UTC(Number(iso[1]), Number(iso[2]), 0)).getUTCDate();
    const timestamp = Date.parse(stamp);
    const value = Number((c[gi] ?? "").replace(",", "."));
    const mgdl = mmol ? value * 18.0182 : value;
    if (
      !calendarValid ||
      !Number.isFinite(timestamp) ||
      !Number.isFinite(mgdl) ||
      mgdl < 20 ||
      mgdl > 600
    )
      errors.push(
        `Row ${headerIndex + index + 2}: invalid timestamp or glucose.`,
      );
    else rows.push({ timestamp, mgdl, source: "csv" });
  });
  const readings = normalize(rows);
  return {
    readings,
    errors,
    duplicates: rows.length - readings.length,
    unit: mmol ? "mmol/L" : "mg/dL",
  };
}
