# ProfileOut JavaScript SDK

Official JavaScript and TypeScript client for the [ProfileOut API](https://docs.profileout.com).

Requires Node.js 22 or newer. ESM only. No runtime dependencies. Use this SDK on your server; never put a ProfileOut API key in browser code.

## Install

```sh
npm install profileout
```

## Quick start

Get an API key from the [ProfileOut console](https://console.profileout.com). The account must be active and email-verified, with sufficient credits.

```js
import { ProfileOut } from "profileout";

const client = new ProfileOut({ apiKey: process.env.PROFILEOUT_API_KEY });
const request = await client.createPeopleData({ linkedin_id: "example-person" });
const response = ["completed", "failed"].includes(request.status)
  ? request
  : await client.waitForPeopleData(request.request_id);

if (response.status === "failed") {
  console.error(response.error);
} else {
  console.log(response.result);
}
```

Responses retain the API's original snake_case fields. TypeScript request and response types are included. Nested profile fields can vary; narrow `unknown` values before use.

## APIs

| Operation | Method |
| --- | --- |
| Submit / read a profile | `createPeopleData(input)` / `getPeopleData(requestId)` |
| Download profile image | `getPeopleDataImage(requestId)` → `Uint8Array` |
| Upload / read a resume | `createProfileParsing(blob, filename)` / `getProfileParsing(requestId)` |
| Submit / read contact enrichment | `createContactEnrichment(input)` / `getContactEnrichment(requestId)` |
| Start / continue a search | `createPeopleSearch({ message })` / `continuePeopleSearch(sessionId, { message })` |
| Read a search | `getPeopleSearch(sessionId)` |
| Check service health | `getHealth()` (does not send the API key) |

People Data and Contact Enrichment accept exactly one identity form:

```js
{ linkedin_id: "example-person" }
{ profile_url: "https://www.linkedin.com/in/example-person" }
{ platform: "github", account_id: "example-person" }
```

Platforms: `linkedin`, `github`, `x`, `twitter`, `facebook`. Facebook numeric IDs must be strings.

### Resume upload

```js
import { readFile } from "node:fs/promises";

const file = new Blob([await readFile("./resume.pdf")], { type: "application/pdf" });
const request = await client.createProfileParsing(file, "resume.pdf");
const response = await client.waitForProfileParsing(request.request_id);
console.log(response.status, response.result, response.error);
```

Files must be nonempty, at most 10 MiB, and PDF, PNG, JPEG, or TIFF. Supply a basename with a matching extension. The service validates the file signature.

### Search conversation

```js
const session = await client.createPeopleSearch({ message: "Find senior backend engineers in Seoul." });
const response = await client.waitForPeopleSearch(session.session_id);
console.log(response.status, response.follow_up, response.role_summary, response.filters);

// After reviewing the response, optionally send a new paid revision:
const revision = await client.continuePeopleSearch(session.session_id, { message: "Require Python experience." });
console.log(revision.revision);
```

Wait methods always read the current request/session state; they do not pin a search revision. Avoid concurrently updating a session while waiting for a particular revision.

## Polling, errors, and timeouts

`waitForPeopleData`, `waitForProfileParsing`, `waitForContactEnrichment`, and `waitForPeopleSearch` accept an ID. They wait at least five seconds before the first GET and between pending results, honor longer `next_poll_after_seconds` hints, and return on either `completed` or `failed`. Always inspect `status`; HTTP 200 can contain a failed job, and search outputs can contain their own errors.

The default request timeout is 120 seconds; the default overall polling timeout is 20 minutes. Configure requests through the client and polling through the wait method:

```js
const client = new ProfileOut({
  apiKey: process.env.PROFILEOUT_API_KEY,
  timeoutMs: 120_000,
});
const response = await client.waitForPeopleData(requestId, {
  timeoutMs: 1_800_000,
  signal: AbortSignal.timeout(1_800_000),
});
```

Every API method accepts `{ signal }` as its final options argument. Timeouts and cancellation stop local waiting; processing on the server may continue.

```js
import { ProfileOutError } from "profileout";

try {
  const response = await client.getPeopleData(requestId);
  console.log(response.status);
} catch (error) {
  if (error instanceof ProfileOutError) {
    console.error(error.status, error.code, error.requestId);
    // error.body contains the response; error.headers includes retry-after if present.
  } else {
    throw error; // Native network, timeout, cancellation, or input errors.
  }
}
```

**No requests are automatically retried.** Each accepted POST, including repeated submissions and search revisions, can reserve credits. After an ambiguous failure, recover a known request ID and use GET instead of blindly repeating POST. GET polling does not reserve additional credits. See [billing](https://docs.profileout.com/guides/billing).

The optional `baseUrl` defaults to `https://api.profileout.com`. HTTPS is required except on localhost; redirects are rejected so credentials and paid requests cannot be forwarded.

## Publishing to npm (maintainers)

Publishing is automated by [`.github/workflows/publish.yml`](.github/workflows/publish.yml). A published, non-prerelease GitHub Release triggers checks and then publishes to npm using Trusted Publishing (OIDC). No npm token or interactive login is needed in GitHub Actions.

### One-time setup

1. Push the workflow to `ProfileOut/profileout-js`.
2. In the repository's **Settings → Environments**, create an environment named `npm`. Leave required reviewers unset for automatic publishing; adding reviewers makes each release wait for approval.
3. On the [npm package page](https://www.npmjs.com/package/profileout), open **Settings → Trusted publishing**, select **GitHub Actions**, and enter:

| Setting | Value |
| --- | --- |
| Organization or user | `ProfileOut` |
| Repository | `profileout-js` |
| Workflow filename | `publish.yml` |
| Environment name | `npm` |
| Allowed actions | Enable **npm publish** (direct publishing) |

Use only the workflow filename, not its directory path. No GitHub Actions secret is required. See the [official npm Trusted Publishing guide](https://docs.npmjs.com/trusted-publishers/).

### Publish a release

1. Change `version` in `package.json` to an unused stable version, for example `0.1.1`.
2. Commit and push the version, code, README, and workflow changes.
3. In this repository's **Releases → Draft a new release**, create the matching tag, for example `v0.1.1`, on that commit. Leave **Set as a pre-release** unchecked, then click **Publish release**.
4. Check the **Publish to npm** workflow in Actions and confirm the version on [npm](https://www.npmjs.com/package/profileout).

The workflow requires an exact `vMAJOR.MINOR.PATCH` tag matching `package.json`. It checks syntax, imports, and package contents before publishing. It runs on GitHub-hosted Ubuntu with Node.js 24 and its bundled npm; the SDK still supports Node.js 22+. No SDK dependency installation or compilation is needed.

A push or tag push alone does not publish. Draft releases and prereleases do not publish. Publishing a release does not bump the package version automatically. Published versions cannot be overwritten; README updates also need a new package version. If authentication fails before upload, finish Trusted Publishing setup and rerun the failed workflow.

## API compatibility

Targets the ProfileOut v1 public API. When that contract changes, review both SDKs against the service's OpenAPI specification and update request/response types and examples together.

## License

[MIT](LICENSE). The license covers SDK code; API access and credits are provided separately by ProfileOut.
