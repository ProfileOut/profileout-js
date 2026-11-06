// Response types follow the ProfileOut v1 OpenAPI contract. Nested profile data may vary.
export type Issue = { code: string; message: string };

export type ErrorResponse = { error: Issue };

export type IdentityInput =
  | {
      profile_url: string;
      linkedin_id?: never;
      platform?: never;
      account_id?: never;
    }
  | {
      linkedin_id: string;
      profile_url?: never;
      platform?: never;
      account_id?: never;
    }
  | {
      platform: "linkedin" | "github" | "x" | "twitter" | "facebook";
      account_id: string;
      profile_url?: never;
      linkedin_id?: never;
    };

export type SearchMessage = { message: string };

export type Verification = {
  status: "verified" | "unverified" | "risky" | "unknown";
  checked_at: string | null;
};

export type ContactResult = {
  emails: Array<{
    email: string;
    type: "work" | "personal" | "unknown";
    verification: Verification;
  }>;
  phones: Array<{
    number: string;
    type: "mobile" | "landline" | "unknown";
    verification: Verification;
  }>;
} | null;

export type ParsingResult = { [key: string]: unknown } | null;

export type PeopleDataResult = {
  info: { image: string | null; [key: string]: unknown };
  experiences: Array<unknown>;
  educations: Array<unknown>;
  [key: string]: unknown;
} | null;

export type FilterNode = { value: string; children?: Array<FilterNode> };

export type StringSelection = { included: Array<string>; not: Array<string> };

export type TreeSelection = {
  included: Array<FilterNode>;
  not: Array<FilterNode>;
};

export type FollowUp = {
  question: string | null;
  example_answers: Array<string>;
} | null;

export type RoleSummary = {
  title: string;
  summary: string;
  highlights: Array<string>;
} | null;

export type SearchFilters = {
  occupations?: TreeSelection;
  expertise?: TreeSelection;
  industries?: TreeSelection;
  positions?: TreeSelection;
  locations?: TreeSelection;
  majors?: TreeSelection;
  hard_skills?: StringSelection;
  languages?: StringSelection;
  company_name?: StringSelection;
  company_size?: StringSelection;
  university_name?: StringSelection;
  education_level?: StringSelection;
  company_keyword?: StringSelection;
  university_keyword?: StringSelection;
  language_keyword?: StringSelection;
  experiences?: { min: number; max: number };
  keywords?: { and: Array<string>; or: Array<string>; not: Array<string> };
  [key: string]: unknown;
} | null;

export type ContactResponse = {
  request_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  result: ContactResult;
  next_poll_after_seconds?: 5;
  error?: { code: string; message: string } | null;
  warnings?: Array<Issue>;
};

export type ParsingResponse = {
  request_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  result: ParsingResult;
  next_poll_after_seconds?: 5;
  error?: { code: string; message: string } | null;
};

export type PeopleDataResponse = {
  request_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  result: PeopleDataResult;
  next_poll_after_seconds?: 5;
  error?: { code: string; message: string } | null;
};

export type FollowUpOutput = {
  status: "pending" | "processing" | "completed" | "failed";
  data: FollowUp;
  error?: Issue;
};

export type RoleSummaryOutput = {
  status: "pending" | "processing" | "completed" | "failed";
  data: RoleSummary;
  error?: Issue;
};

export type FiltersOutput = {
  status: "pending" | "processing" | "completed" | "failed";
  data: SearchFilters;
  error?: Issue;
};

export type SearchSession = {
  session_id: string;
  revision: number;
  status: "pending" | "processing" | "completed" | "failed";
  follow_up: FollowUpOutput;
  role_summary: RoleSummaryOutput;
  filters: FiltersOutput;
  error?: Issue;
  next_poll_after_seconds?: 5;
};

export interface ProfileOutOptions {
  apiKey: string;
  baseUrl?: string;
  /** Request timeout in milliseconds. Default: 120000. */
  timeoutMs?: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
}
export interface WaitOptions extends RequestOptions {
  /** Overall polling timeout in milliseconds. Default: 1200000. */
  timeoutMs?: number;
}

export interface ErrorDetails {
  status?: number;
  code?: string;
  /** HTTP call ID from X-Request-ID, not the ID used for polling. */
  requestId?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ProfileOutError extends Error {
  constructor(message: string, details?: ErrorDetails);
  status?: number;
  code?: string;
  requestId?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ProfileOut {
  constructor(options: ProfileOutOptions);
  createPeopleData(
    input: IdentityInput,
    options?: RequestOptions,
  ): Promise<PeopleDataResponse>;
  getPeopleData(
    requestId: string,
    options?: RequestOptions,
  ): Promise<PeopleDataResponse>;
  getPeopleDataImage(
    requestId: string,
    options?: RequestOptions,
  ): Promise<Uint8Array>;
  waitForPeopleData(
    requestId: string,
    options?: WaitOptions,
  ): Promise<PeopleDataResponse>;
  createProfileParsing(
    file: Blob,
    filename: string,
    options?: RequestOptions,
  ): Promise<ParsingResponse>;
  getProfileParsing(
    requestId: string,
    options?: RequestOptions,
  ): Promise<ParsingResponse>;
  waitForProfileParsing(
    requestId: string,
    options?: WaitOptions,
  ): Promise<ParsingResponse>;
  createContactEnrichment(
    input: IdentityInput,
    options?: RequestOptions,
  ): Promise<ContactResponse>;
  getContactEnrichment(
    requestId: string,
    options?: RequestOptions,
  ): Promise<ContactResponse>;
  waitForContactEnrichment(
    requestId: string,
    options?: WaitOptions,
  ): Promise<ContactResponse>;
  createPeopleSearch(
    input: SearchMessage,
    options?: RequestOptions,
  ): Promise<SearchSession>;
  continuePeopleSearch(
    sessionId: string,
    input: SearchMessage,
    options?: RequestOptions,
  ): Promise<SearchSession>;
  getPeopleSearch(
    sessionId: string,
    options?: RequestOptions,
  ): Promise<SearchSession>;
  waitForPeopleSearch(
    sessionId: string,
    options?: WaitOptions,
  ): Promise<SearchSession>;
  getHealth(options?: RequestOptions): Promise<{ status: "ok" }>;
}
