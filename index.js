import { setTimeout as sleep } from "node:timers/promises";

function milliseconds(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) {
    throw new TypeError(`${name} must be a positive integer no greater than 2147483647.`);
  }
  return value;
}

function idPath(resource, id) {
  if (typeof id !== "string" || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) {
    throw new TypeError("A UUID request_id or session_id is required.");
  }
  return `/v1/${resource}/${id}`;
}

export class ProfileOutError extends Error {
  constructor(message, { status, code, requestId, body, headers } = {}) {
    super(message);
    this.name = "ProfileOutError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.body = body;
    this.headers = headers;
  }
}

export class ProfileOut {
  #apiKey;
  #baseUrl;
  #timeoutMs;

  constructor({ apiKey, baseUrl = "https://api.profileout.com", timeoutMs = 120_000 } = {}) {
    if (typeof apiKey !== "string" || !/^[\x21-\x7e]+$/.test(apiKey)) {
      throw new TypeError("apiKey must be a nonempty API key without whitespace.");
    }
    const url = new URL(baseUrl);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
      url.username || url.password || url.search || url.hash
    ) {
      throw new TypeError("baseUrl must use HTTPS (HTTP is allowed on localhost) without credentials, query, or fragment.");
    }
    this.#apiKey = apiKey;
    this.#baseUrl = url.href.replace(/\/+$/, "");
    this.#timeoutMs = milliseconds(timeoutMs, "timeoutMs");
  }

  async #request(method, path, body, { signal } = {}, binary = false) {
    const timeout = AbortSignal.timeout(this.#timeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const headers = { Accept: binary ? "image/*" : "application/json" };
    if (path !== "/health") headers.Authorization = `Bearer ${this.#apiKey}`;
    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    const response = await fetch(this.#baseUrl + path, {
      method, headers, body, signal: requestSignal,
      // Never forward API keys or replay a paid POST through a redirect.
      redirect: "manual",
    });
    if (response.ok && binary) return new Uint8Array(await response.arrayBuffer());

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    const details = {
      status: response.status,
      requestId: response.headers.get("x-request-id") ?? undefined,
      body: data,
      headers: Object.fromEntries(response.headers),
    };
    if (!response.ok) {
      throw new ProfileOutError(
        typeof data?.error?.message === "string" ? data.error.message : `ProfileOut returned HTTP ${response.status}.`,
        { ...details, code: typeof data?.error?.code === "string" ? data.error.code : undefined },
      );
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new ProfileOutError("ProfileOut returned an invalid JSON object.", { ...details, code: "invalid_response" });
    }
    return data;
  }

  async #wait(path, { timeoutMs = 1_200_000, signal } = {}) {
    const timeout = AbortSignal.timeout(milliseconds(timeoutMs, "timeoutMs"));
    const waitSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let delay = 5_000;
    try {
      while (true) {
        await sleep(delay, undefined, { signal: waitSignal });
        const data = await this.#request("GET", path, undefined, { signal: waitSignal });
        if (data.status === "completed" || data.status === "failed") return data;
        if (!["queued", "pending", "processing"].includes(data.status)) {
          throw new ProfileOutError("ProfileOut returned an unknown processing status.", { code: "invalid_response", body: data });
        }
        const hint = data.next_poll_after_seconds * 1_000;
        delay = Number.isSafeInteger(hint) && hint > 0 && hint <= 2_147_483_647 ? Math.max(5_000, hint) : 5_000;
      }
    } catch (error) {
      if (waitSignal.aborted) throw waitSignal.reason;
      throw error;
    }
  }

  createPeopleData(input, options) {
    return this.#request("POST", "/v1/people-data", input, options);
  }

  getPeopleData(requestId, options) {
    return this.#request("GET", idPath("people-data", requestId), undefined, options);
  }

  getPeopleDataImage(requestId, options) {
    return this.#request("GET", idPath("people-data", requestId) + "/image", undefined, options, true);
  }

  waitForPeopleData(requestId, options) {
    return this.#wait(idPath("people-data", requestId), options);
  }

  createProfileParsing(file, filename, options) {
    if (!(file instanceof Blob) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      throw new TypeError("file must be a nonempty Blob no larger than 10 MiB.");
    }
    if (
      typeof filename !== "string" || filename.length > 255 ||
      /[\x00-\x1f\x7f/\\]/.test(filename) ||
      !/\.(pdf|png|jpe?g|tiff?)$/i.test(filename)
    ) {
      throw new TypeError("filename must be a PDF, PNG, JPEG, or TIFF basename of at most 255 characters.");
    }
    const form = new FormData();
    form.set("file", file, filename);
    return this.#request("POST", "/v1/profile-parsings", form, options);
  }

  getProfileParsing(requestId, options) {
    return this.#request("GET", idPath("profile-parsings", requestId), undefined, options);
  }

  waitForProfileParsing(requestId, options) {
    return this.#wait(idPath("profile-parsings", requestId), options);
  }

  createContactEnrichment(input, options) {
    return this.#request("POST", "/v1/contact-enrichments", input, options);
  }

  getContactEnrichment(requestId, options) {
    return this.#request("GET", idPath("contact-enrichments", requestId), undefined, options);
  }

  waitForContactEnrichment(requestId, options) {
    return this.#wait(idPath("contact-enrichments", requestId), options);
  }

  createPeopleSearch(input, options) {
    return this.#request("POST", "/v1/people-searches", input, options);
  }

  continuePeopleSearch(sessionId, input, options) {
    return this.#request("POST", idPath("people-searches", sessionId), input, options);
  }

  getPeopleSearch(sessionId, options) {
    return this.#request("GET", idPath("people-searches", sessionId), undefined, options);
  }

  waitForPeopleSearch(sessionId, options) {
    return this.#wait(idPath("people-searches", sessionId), options);
  }

  getHealth(options) {
    return this.#request("GET", "/health", undefined, options);
  }
}
