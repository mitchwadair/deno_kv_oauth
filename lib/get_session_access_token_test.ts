// Copyright 2023 the Deno authors. All rights reserved. MIT license.
import { getSessionAccessToken } from "./get_session_access_token.ts";
import {
  assertEquals,
  assertRejects,
  returnsNext,
  Status,
  stub,
  type Tokens,
} from "../dev_deps.ts";
import { getTokens, setTokens } from "./_core.ts";
import { randomOAuthConfig, randomTokens } from "./_test_utils.ts";

Deno.test("getSessionAccessToken() returns null for non-existent session", async () => {
  assertEquals(await getSessionAccessToken(randomOAuthConfig(), "nil"), null);
});

Deno.test("getSessionAccessToken() returns the access token for session without refresh token", async () => {
  const sessionId = crypto.randomUUID();
  const tokens: Tokens = {
    ...randomTokens(),
    expiresIn: 3, // if we had a refresh token this would cause a refresh
  };
  await setTokens(sessionId, tokens);
  assertEquals(
    await getSessionAccessToken(randomOAuthConfig(), sessionId),
    tokens.accessToken,
  );
});

Deno.test("getSessionAccessToken() returns the access token for session without expiry", async () => {
  const sessionId = crypto.randomUUID();
  const tokens: Tokens = {
    ...randomTokens(),
    refreshToken: crypto.randomUUID(),
  };
  await setTokens(sessionId, tokens);
  assertEquals(
    await getSessionAccessToken(randomOAuthConfig(), sessionId),
    tokens.accessToken,
  );
});

Deno.test("getSessionAccessToken() returns the access token for session with far expiry", async () => {
  const sessionId = crypto.randomUUID();
  const tokens: Tokens = {
    ...randomTokens(),
    refreshToken: crypto.randomUUID(),
    expiresIn: 30,
  };
  await setTokens(sessionId, tokens);
  assertEquals(
    await getSessionAccessToken(randomOAuthConfig(), sessionId),
    tokens.accessToken,
  );
});

Deno.test("getSessionAccessToken() rejects for an access token which expires in less than 5 seconds", async () => {
  const sessionId = crypto.randomUUID();
  const tokens: Tokens = {
    ...randomTokens(),
    refreshToken: crypto.randomUUID(),
    expiresIn: 3,
  };
  await setTokens(sessionId, tokens);
  await assertRejects(async () =>
    await getSessionAccessToken(randomOAuthConfig(), sessionId)
  );
});

Deno.test("getSessionAccessToken() rejects for an expired access token", async () => {
  const sessionId = crypto.randomUUID();
  const tokens: Tokens = {
    ...randomTokens(),
    refreshToken: crypto.randomUUID(),
    expiresIn: 0,
  };
  await setTokens(sessionId, tokens);
  await assertRejects(async () =>
    await getSessionAccessToken(randomOAuthConfig(), sessionId)
  );
});

Deno.test("getSessionAccessToken() returns null for an expired refresh token", async () => {
  const fetchStub = stub(
    window,
    "fetch",
    returnsNext([
      Promise.resolve(
        Response.json({ error: "invalid_grant" }, {
          status: Status.BadRequest,
        }),
      ),
    ]),
  );

  const sessionId = crypto.randomUUID();
  const tokens: Tokens = {
    ...randomTokens(),
    refreshToken: crypto.randomUUID(),
    expiresIn: 3,
  };
  await setTokens(sessionId, tokens);
  const accessToken = await getSessionAccessToken(
    randomOAuthConfig(),
    sessionId,
  );
  fetchStub.restore();

  assertEquals(accessToken, null);
});

Deno.test("getSessionAccessToken() returns a refreshed access token", async () => {
  const newTokens = randomTokens();
  const fetchStub = stub(
    window,
    "fetch",
    returnsNext([Promise.resolve(Response.json({
      access_token: newTokens.accessToken,
      token_type: newTokens.tokenType,
    }))]),
  );

  const sessionId = crypto.randomUUID();
  const tokens: Tokens = {
    ...randomTokens(),
    refreshToken: crypto.randomUUID(),
    expiresIn: 3,
  };
  await setTokens(sessionId, tokens);
  const accessToken = await getSessionAccessToken(
    randomOAuthConfig(),
    sessionId,
  );
  fetchStub.restore();

  assertEquals(accessToken, newTokens.accessToken);
  assertEquals(await getTokens(sessionId), newTokens);
});
