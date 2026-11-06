# ProfileOut JavaScript SDK

Official JavaScript and TypeScript client for the [ProfileOut API](https://docs.profileout.com).

Requires Node.js 22 or newer. ESM only. No runtime dependencies. Use this SDK on your server; never put a ProfileOut API key in browser code.

## Install

```sh
npm install profileout
```

The installation command above becomes available after the first npm publication. Until then, install a local checkout with `npm install /path/to/profileout-js`.

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

Package name: `profileout`. Initial version: `0.1.0`. This repository is ready to package, but no registry account or package is created by cloning it.

1. [Create an npm account](https://www.npmjs.com/signup), verify your email, and enable two-factor authentication.
2. Check that you can publish the name. `npm view profileout name` returns E404 before the first publication; if the name belongs to someone else, change `name` in `package.json` and the installation/import examples.
3. From this repository:

```sh
npm run check
npm pack --dry-run
npm login --registry=https://registry.npmjs.org/
npm publish --access public
```

No dependency installation or compilation is required to publish. The package allowlist includes only `index.js`, `index.d.ts`, `README.md`, and `LICENSE`, plus npm's required `package.json`.

Confirm publication with `npm view profileout version`. Later releases need a new version in `package.json`; an existing name/version cannot be reused. The files that are published become public. Never put credentials in this repository.

See the [official npm publishing guide](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/).

## API compatibility

Targets the ProfileOut v1 public API. When that contract changes, review both SDKs against the service's OpenAPI specification and update request/response types and examples together.

## License

[MIT](LICENSE). The license covers SDK code; API access and credits are provided separately by ProfileOut.
