import { test } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../server/testkit";
import { defaultProfile, defaultPrivacy } from "../src/domain/profile";
const H = { "X-Gluca-Request": "1" };
async function account(
  a: Awaited<ReturnType<typeof startApp>>,
  username: string,
) {
  const r = await a.call("POST", "/api/accounts", {
    headers: H,
    body: { username, password: "synthetic-profile-passphrase" },
  });
  assert.equal(r.status, 201);
  return r.headers.get("set-cookie")!.split(";")[0];
}
test("private profile requires session, encrypted storage, ownership and no raw body logging", async () => {
  const a = await startApp();
  try {
    assert.equal((await a.call("GET", "/api/profile")).status, 401);
    const owner = await account(a, "profile-one"),
      other = await account(a, "profile-two");
    const profile = {
      ...defaultProfile(),
      displayName: "Fictional Maple",
      username: "fictional_maple",
      role: "living",
      diagnosis: { year: 2004 },
      birthday: { month: 2, day: 29 },
      cgm: { brand: "dexcom", model: "G7" },
      onboarded: true,
    };
    const saved = await a.call("POST", "/api/profile", {
      cookie: owner,
      headers: H,
      body: {
        profile,
        privacy: defaultPrivacy(),
        revision: 0,
        userId: "someone-else",
      },
    });
    assert.equal(saved.status, 200);
    const own = await a.call("GET", "/api/profile", { cookie: owner });
    assert.deepEqual(own.json.profile.diagnosis, { year: 2004 });
    const theirs = await a.call("GET", "/api/profile", { cookie: other });
    assert.equal(theirs.json.revision, 0);
    assert.equal(theirs.json.profile.diagnosis, undefined);
    const row = a.app.deps.db
      .prepare("SELECT payload_enc FROM user_profiles")
      .get() as { payload_enc: string };
    assert.match(row.payload_enc, /^v2\./);
    assert.ok(!row.payload_enc.includes("Fictional Maple"));
    assert.ok(!a.logs.join("").includes("2004"));
    const visible = await a.call(
      "GET",
      "/api/profiles/public?username=fictional_maple",
      { cookie: other },
    );
    assert.equal(visible.status, 200);
    assert.deepEqual(Object.keys(visible.json).sort(), [
      "name",
      "pinnedAchievements",
      "username",
    ]);
    assert.equal(
      (await a.call("GET", "/api/profiles/public?username=fictional_maple"))
        .status,
      401,
    );
    assert.equal(
      a.app.deps.db.prepare("SELECT COUNT(*) AS n FROM egvs").get()!.n,
      0,
    );
  } finally {
    await a.close();
  }
});
test("profile opt-ins reveal derived shield only, concurrent edits conflict, handle uniqueness is atomic", async () => {
  const a = await startApp();
  try {
    const owner = await account(a, "shield-owner"),
      other = await account(a, "shield-other");
    const profile = {
      ...defaultProfile(),
      username: "maple_shield",
      role: "living",
      diagnosis: { year: 2000, month: 2, day: 29 },
      birthday: { month: 4, day: 5 },
      cgm: { brand: "dexcom", model: "G7" },
    };
    const privacy = {
      ...defaultPrivacy(),
      showShield: true,
      showShieldNumber: true,
      showCgm: true,
      showBirthday: true,
    };
    assert.equal(
      (
        await a.call("POST", "/api/profile", {
          cookie: owner,
          headers: H,
          body: { profile, privacy, revision: 0 },
        })
      ).status,
      200,
    );
    const pub = (
      await a.call("GET", "/api/profiles/public?username=maple_shield", {
        cookie: other,
      })
    ).json;
    assert.ok(pub.shield);
    assert.equal(pub.cgm.model, "G7");
    assert.equal(pub.diagnosis, undefined);
    assert.equal(pub.birthday, undefined);
    assert.equal(pub.ageConfirmed, undefined);
    assert.equal(
      (
        await a.call("POST", "/api/profile", {
          cookie: owner,
          headers: H,
          body: { profile, privacy, revision: 0 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await a.call("POST", "/api/profile", {
          cookie: other,
          headers: H,
          body: { profile, privacy, revision: 0 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await a.call("POST", "/api/profile", {
          cookie: owner,
          body: { profile, privacy, revision: 1 },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await a.call("POST", "/api/profile", {
          cookie: owner,
          headers: H,
          body: { profile, privacy: {}, revision: 1 },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await a.call("GET", "/api/profiles/public?username=maple_shield", {
          cookie: other,
        })
      ).json.shield,
      undefined,
    );
  } finally {
    await a.close();
  }
});
test("profile validation rejects malformed/future dates, invalid handles, remote photos and array payloads", async () => {
  const a = await startApp();
  try {
    const cookie = await account(a, "profile-validation");
    for (const p of [
      { diagnosis: { year: 2099 } },
      { diagnosis: { year: 2001, month: 2, day: 29 } },
      { username: "bad handle" },
      { photo: "https://tracker.example.test/photo" },
      [],
    ]) {
      const r = await a.call("POST", "/api/profile", {
        cookie,
        headers: H,
        body: {
          profile: { ...defaultProfile(), ...p },
          privacy: defaultPrivacy(),
          revision: 0,
        },
      });
      if (!Array.isArray(p)) assert.equal(r.status, 400);
    }
    assert.equal(
      (
        await a.call("POST", "/api/profile", {
          cookie,
          headers: H,
          body: { profile: [], privacy: [], revision: 0 },
        })
      ).status,
      400,
    );
  } finally {
    await a.close();
  }
});
test("profile persists across logout and login without crossing account boundaries", async () => {
  const a = await startApp();
  try {
    const cookie = await account(a, "returning-profile");
    await a.call("POST", "/api/profile", {
      cookie,
      headers: H,
      body: {
        profile: {
          ...defaultProfile(),
          onboarded: true,
          displayName: "Synthetic Rowan",
        },
        privacy: defaultPrivacy(),
        revision: 0,
      },
    });
    await a.call("POST", "/api/session/logout", { cookie, headers: H });
    assert.equal((await a.call("GET", "/api/profile", { cookie })).status, 401);
    const login = await a.call("POST", "/api/session", {
      headers: H,
      body: {
        username: "returning-profile",
        password: "synthetic-profile-passphrase",
      },
    });
    assert.equal(login.status, 200);
    const next = login.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (await a.call("GET", "/api/profile", { cookie: next })).json.profile
        .displayName,
      "Synthetic Rowan",
    );
  } finally {
    await a.close();
  }
});

test("profile storage fails closed without an encryption key", async () => {
  const a = await startApp({ tokenEncryptionKey: "" });
  try {
    const cookie = await account(a, "profile-no-key");
    assert.equal((await a.call("GET", "/api/profile", { cookie })).status, 503);
    assert.equal(
      (
        await a.call("POST", "/api/profile", {
          cookie,
          headers: H,
          body: {
            profile: defaultProfile(),
            privacy: defaultPrivacy(),
            revision: 0,
          },
        })
      ).status,
      503,
    );
    assert.equal(
      a.app.deps.db.prepare("SELECT COUNT(*) AS n FROM user_profiles").get()!.n,
      0,
    );
  } finally {
    await a.close();
  }
});
