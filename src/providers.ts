import { Reading } from "./types";
import { normalize } from "./analytics";
export interface GlucoseProvider {
  id: string;
  connected: boolean;
  getReadings(start: number, end: number): Promise<Reading[]>;
}
export function synthetic(end: number): Reading[] {
  const rows: Reading[] = [];
  const anchor = Math.floor(end / 300000) * 300000;
  for (let i = 0; i < 31 * 288; i++) {
    if (i % 1700 > 1590 || i % 997 < 5) continue;
    const t = anchor - i * 300000;
    const h = new Date(t).getHours();
    const meal = Math.max(0, Math.sin(((h - 7) * Math.PI) / 6)) * 48;
    rows.push({
      timestamp: t,
      mgdl: Math.round(
        119 +
          meal +
          27 * Math.sin(i / 33) +
          16 * Math.sin(i / 9) +
          (Math.floor(i / 288) % 6 === 0 ? 35 * Math.sin(i / 13) : 0),
      ),
      source: "mock",
    });
  }
  return normalize(rows);
}
export class MockGlucoseProvider implements GlucoseProvider {
  id = "mock";
  connected = true;
  constructor(public readings = synthetic(Date.now())) {}
  async getReadings(start: number, end: number) {
    return this.readings.filter(
      (r) => r.timestamp >= start && r.timestamp < end,
    );
  }
}
export class CsvGlucoseProvider implements GlucoseProvider {
  id = "csv";
  connected = true;
  constructor(public readings: Reading[]) {}
  async getReadings(start: number, end: number) {
    return this.readings.filter(
      (r) => r.timestamp >= start && r.timestamp < end,
    );
  }
}
export class PlannedProvider implements GlucoseProvider {
  connected = false;
  constructor(public id: string) {}
  async getReadings(): Promise<Reading[]> {
    throw new Error(`${this.id} is planned and is not connected.`);
  }
}
export const DexcomGlucoseProvider = () => new PlannedProvider("Dexcom");
export const AppleHealthGlucoseProvider = () =>
  new PlannedProvider("Apple Health");
export const HealthConnectGlucoseProvider = () =>
  new PlannedProvider("Health Connect");
