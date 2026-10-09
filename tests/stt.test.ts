import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let server: http.Server;
beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("latin1");
      const text = body.includes("fantasma") ? "Gracias por ver el video" : "Buenas tardes, General.";
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ text }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.OPENAI_API_KEY = "test-key";
});
afterAll(() => server.close());

function req(blob: Blob) {
  const fd = new FormData();
  fd.append("audio", blob, "voz.wav");
  return new Request("http://localhost/api/stt", { method: "POST", body: fd, headers: { "x-forwarded-for": "9.9.9.9" } });
}

describe("/api/stt", () => {
  it("devuelve el texto transcripto", async () => {
    const { POST } = await import("@/app/api/stt/route");
    const r = await POST(req(new Blob([new Uint8Array(4000)], { type: "audio/wav" })));
    expect(r.status).toBe(200);
    expect((await r.json()).text).toBe("Buenas tardes, General.");
  });
  it("descarta audios diminutos y frases fantasma", async () => {
    const { POST } = await import("@/app/api/stt/route");
    expect((await POST(req(new Blob([new Uint8Array(100)])))).status).toBe(400);
    const r = await POST(req(new Blob([new Uint8Array(3000), "fantasma"])));
    expect((await r.json()).text).toBe("");
  });
});
