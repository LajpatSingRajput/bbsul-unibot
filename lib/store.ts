import { randomUUID } from "node:crypto";
import { firebase } from "./firebase-server";
import { seedData } from "./seed";
import type { Row } from "./types";
const demos = new Map<string, Record<string, Row[]>>();
export class Store {
  constructor(public demoId?: string) {
    if (demoId && !demos.has(demoId)) demos.set(demoId, seedData());
  }
  async list(
    collection: string,
    field?: string,
    value?: unknown,
  ): Promise<Row[]> {
    if (this.demoId) {
      const rows = demos.get(this.demoId)![collection] || [];
      return structuredClone(rows.filter((x) => !field || x[field] === value));
    }
    let q: any = firebase().db.collection(collection);
    if (field) q = q.where(field, "==", value);
    const s = await q.get();
    return s.docs.map((d: any) => ({ ...d.data(), id: d.id }));
  }
  async get(collection: string, id: string): Promise<Row | null> {
    if (this.demoId)
      return (await this.list(collection)).find((r) => r.id === id) || null;
    const s = await firebase().db.collection(collection).doc(id).get();
    return s.exists ? { ...s.data(), id: s.id } : null;
  }
  async put(
    collection: string,
    data: any,
    id: string = randomUUID(),
  ): Promise<Row> {
    const row = JSON.parse(JSON.stringify({ ...data, id }));
    if (this.demoId) {
      const db = demos.get(this.demoId)!;
      const arr = db[collection] || (db[collection] = []);
      const i = arr.findIndex((r) => r.id === id);
      if (i < 0) arr.push(row);
      else arr[i] = row;
    } else await firebase().db.collection(collection).doc(id).set(row);
    return row;
  }
  async patch(collection: string, id: string, data: any) {
    const existing = await this.get(collection, id);
    if (!existing) throw new Error("Record not found");
    return this.put(collection, { ...existing, ...data }, id);
  }
  async remove(collection: string, id: string) {
    if (this.demoId) {
      const db = demos.get(this.demoId)!;
      db[collection] = (db[collection] || []).filter((r) => r.id !== id);
    } else
      await firebase().db.recursiveDelete(
        firebase().db.collection(collection).doc(id),
      );
  }
}
