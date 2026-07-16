var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var supportedProviders = ["github", "gitlab"];
var escapeRegExp = /* @__PURE__ */ __name((str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "escapeRegExp");
var outputHTML = /* @__PURE__ */ __name(({ provider = "unknown", token, error, errorCode }) => {
  const state = error ? "error" : "success";
  const content = error ? { provider, error, errorCode } : { provider, token };
  return new Response(
    `
      <!doctype html><html><body><script>
        (() => {
          window.addEventListener('message', ({ data, origin }) => {
            if (data === 'authorizing:${provider}') {
              window.opener?.postMessage(
                'authorization:${provider}:${state}:${JSON.stringify(content)}',
                origin
              );
            }
          });
          window.opener?.postMessage('authorizing:${provider}', '*');
        })();
      <\/script></body></html>
    `,
    {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        // Delete CSRF token
        "Set-Cookie": `csrf-token=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure`
      }
    }
  );
}, "outputHTML");
var handleAuth = /* @__PURE__ */ __name(async (request, env) => {
  const { url } = request;
  const { origin, searchParams } = new URL(url);
  const { provider, site_id: domain } = Object.fromEntries(searchParams);
  if (!provider || !supportedProviders.includes(provider)) {
    return outputHTML({
      error: "Your Git backend is not supported by the authenticator.",
      errorCode: "UNSUPPORTED_BACKEND"
    });
  }
  const {
    ALLOWED_DOMAINS,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_HOSTNAME = "github.com",
    GITLAB_CLIENT_ID,
    GITLAB_CLIENT_SECRET,
    GITLAB_HOSTNAME = "gitlab.com"
  } = env;
  if (ALLOWED_DOMAINS && !ALLOWED_DOMAINS.split(/,/).some(
    (str) => (
      // Escape the input, then replace a wildcard for regex
      (domain ?? "").match(new RegExp(`^${escapeRegExp(str.trim()).replace("\\*", ".+")}$`))
    )
  )) {
    return outputHTML({
      provider,
      error: "Your domain is not allowed to use the authenticator.",
      errorCode: "UNSUPPORTED_DOMAIN"
    });
  }
  const csrfToken = globalThis.crypto.randomUUID().replaceAll("-", "");
  let authURL = "";
  if (provider === "github") {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return outputHTML({
        provider,
        error: "OAuth app client ID or secret is not configured.",
        errorCode: "MISCONFIGURED_CLIENT"
      });
    }
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope: "repo,user",
      state: csrfToken
    });
    authURL = `https://${GITHUB_HOSTNAME}/login/oauth/authorize?${params.toString()}`;
  }
  if (provider === "gitlab") {
    if (!GITLAB_CLIENT_ID || !GITLAB_CLIENT_SECRET) {
      return outputHTML({
        provider,
        error: "OAuth app client ID or secret is not configured.",
        errorCode: "MISCONFIGURED_CLIENT"
      });
    }
    const params = new URLSearchParams({
      client_id: GITLAB_CLIENT_ID,
      redirect_uri: `${origin}/callback`,
      response_type: "code",
      scope: "api",
      state: csrfToken
    });
    authURL = `https://${GITLAB_HOSTNAME}/oauth/authorize?${params.toString()}`;
  }
  return new Response("", {
    status: 302,
    headers: {
      Location: authURL,
      // Cookie expires in 10 minutes; Use `SameSite=Lax` to make sure the cookie is sent by the
      // browser after redirect
      "Set-Cookie": `csrf-token=${provider}_${csrfToken}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`
    }
  });
}, "handleAuth");
var handleCallback = /* @__PURE__ */ __name(async (request, env) => {
  const { url, headers } = request;
  const { origin, searchParams } = new URL(url);
  const { code, state } = Object.fromEntries(searchParams);
  const [, provider, csrfToken] = headers.get("Cookie")?.match(/\bcsrf-token=([a-z-]+?)_([0-9a-f]{32})\b/) ?? [];
  if (!provider || !supportedProviders.includes(provider)) {
    return outputHTML({
      error: "Your Git backend is not supported by the authenticator.",
      errorCode: "UNSUPPORTED_BACKEND"
    });
  }
  if (!code || !state) {
    return outputHTML({
      provider,
      error: "Failed to receive an authorization code. Please try again later.",
      errorCode: "AUTH_CODE_REQUEST_FAILED"
    });
  }
  if (!csrfToken || state !== csrfToken) {
    return outputHTML({
      provider,
      error: "Potential CSRF attack detected. Authentication flow aborted.",
      errorCode: "CSRF_DETECTED"
    });
  }
  const {
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_HOSTNAME = "github.com",
    GITLAB_CLIENT_ID,
    GITLAB_CLIENT_SECRET,
    GITLAB_HOSTNAME = "gitlab.com"
  } = env;
  let tokenURL = "";
  let requestBody = {};
  if (provider === "github") {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return outputHTML({
        provider,
        error: "OAuth app client ID or secret is not configured.",
        errorCode: "MISCONFIGURED_CLIENT"
      });
    }
    tokenURL = `https://${GITHUB_HOSTNAME}/login/oauth/access_token`;
    requestBody = {
      code,
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET
    };
  }
  if (provider === "gitlab") {
    if (!GITLAB_CLIENT_ID || !GITLAB_CLIENT_SECRET) {
      return outputHTML({
        provider,
        error: "OAuth app client ID or secret is not configured.",
        errorCode: "MISCONFIGURED_CLIENT"
      });
    }
    tokenURL = `https://${GITLAB_HOSTNAME}/oauth/token`;
    requestBody = {
      code,
      client_id: GITLAB_CLIENT_ID,
      client_secret: GITLAB_CLIENT_SECRET,
      grant_type: "authorization_code",
      redirect_uri: `${origin}/callback`
    };
  }
  let response;
  let token = "";
  let error = "";
  try {
    response = await fetch(tokenURL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
  } catch {
  }
  if (!response) {
    return outputHTML({
      provider,
      error: "Failed to request an access token. Please try again later.",
      errorCode: "TOKEN_REQUEST_FAILED"
    });
  }
  try {
    ({ access_token: token, error } = await response.json());
  } catch {
    return outputHTML({
      provider,
      error: "Server responded with malformed data. Please try again later.",
      errorCode: "MALFORMED_RESPONSE"
    });
  }
  return outputHTML({ provider, token, error });
}, "handleCallback");
var index_default = {
  /**
   * The main request handler.
   * @param {Request} request - HTTP request.
   * @param {{ [key: string]: string }} env - Environment variables.
   * @returns {Promise<Response>} HTTP response.
   * @see https://developers.cloudflare.com/workers/runtime-apis/fetch/
   * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
   * @see https://docs.gitlab.com/ee/api/oauth2.html#authorization-code-flow
   */
  async fetch(request, env) {
    const { method, url } = request;
    const { pathname } = new URL(url);
    if (method === "GET" && ["/auth", "/oauth/authorize"].includes(pathname)) {
      return handleAuth(request, env);
    }
    if (method === "GET" && ["/callback", "/oauth/redirect"].includes(pathname)) {
      return handleCallback(request, env);
    }
    return new Response("", { status: 404 });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
