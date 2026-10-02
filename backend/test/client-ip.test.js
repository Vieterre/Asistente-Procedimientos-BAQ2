import test from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "../src/security/client-ip.js";
import { createAppServer } from "../src/server.js";

test("proxy address is accepted only from loopback and only as a single IP", () => {
  const request = (peer, forwarded) => ({
    socket: { remoteAddress: peer },
    headers: { "x-real-ip": forwarded }
  });

  assert.equal(clientIp(request("127.0.0.1", "198.51.100.7")), "127.0.0.1");
  assert.equal(clientIp(request("198.51.100.2", "198.51.100.7"), { trustLoopbackProxy: true }), "198.51.100.2");
  assert.equal(clientIp(request("::1", "198.51.100.7"), { trustLoopbackProxy: true }), "198.51.100.7");
  assert.equal(clientIp(request("127.0.0.1", "198.51.100.7, 198.51.100.8"), { trustLoopbackProxy: true }), "127.0.0.1");
});

test("login attempts behind the local proxy are isolated by client IP", async () => {
  const server = createAppServer({
    trustLoopbackProxy: true,
    poolFactory: () => ({
      query: async () => ({ rows: [] }),
      end: async () => {}
    })
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;
  const login = ip => fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify({ username: "nobody", password: "invalid" })
  });

  try {
    for (let count = 0; count < 10; count += 1) {
      assert.equal((await login("198.51.100.7")).status, 401);
    }
    assert.equal((await login("198.51.100.7")).status, 429);
    assert.equal((await login("198.51.100.8")).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
