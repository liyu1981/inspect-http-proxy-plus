/** biome-ignore-all lint/suspicious/noExplicitAny: necessary */
export interface ProxySession {
  ID: string;
  ConfigID: string;
  CreatedAt: string;
  Timestamp: string;
  DurationMs: number;
  ClientAddr: string;
  ClientIP: string;
  RequestMethod: string;
  RequestPath: string;
  RequestQuery: string;
  RequestProto: string;
  RequestHost: string;
  RequestURLFull: string;
  RequestHeaders: any; // Raw JSON from DB
  QueryParameters: any; // Raw JSON from DB
  RequestBody: string; // Base64 encoded if blob? Or string? Go's []byte marshals to base64 string usually.
  RequestBodySize: number;
  RequestContentType: string;
  RequestContentEncoding: string;
  ResponseStatusCode: number;
  ResponseStatusText: string;
  ResponseHeaders: any; // Raw JSON from DB
  ResponseBody: string; // Base64 encoded
  ResponseBodySize: number;
  ResponseContentType: string;
  ResponseContentEncoding: string;
}

export interface ProxyConfigRow {
  ID: string;
  CreatedAt: string;
  SourcePath: string;
  Cwd: string;
  ConfigJSON: string;
  Fingerprint: string;
  Sessions: any[] | null;
}

export interface ProxyConfig {
  id: string;
  created_at: string;
  config_row: ProxyConfigRow;
  target_url: string;
  truncate_log_body: boolean;
  is_proxyserver_active: boolean;
}

export interface ProxySessionStub {
  ID: string;
  ConfigID: string;
  ResponseStatusCode: number;
  RequestMethod: string;
  RequestPath: string;
  Timestamp: string;
  DurationMs: number;
}

export interface SessionListResponse {
  count: number;
  total?: number;
  sessions: ProxySessionStub[];
  offset?: number;
  limit?: number;
}

export interface SessionDetailResponse {
  session: ProxySession;
  request_headers: Record<string, string[]>;
  response_headers: Record<string, string[]>;
  query_parameters: Record<string, string[]>;
}

export interface MethodStats {
  stats: Record<string, number>;
}

export interface ProxyBookmark {
  ID: string;
  SessionID: string;
  CreatedAt: string;
  Note: string;
  Tags: string;

  // Fields copied from ProxySession
  Timestamp: string;
  DurationMs: number;
  ClientAddr: string;
  ClientIP: string;
  RequestMethod: string;
  RequestPath: string;
  RequestQuery: string;
  RequestProto: string;
  RequestHost: string;
  RequestURLFull: string;
  RequestHeaders: any;
  QueryParameters: any;
  RequestBody: string;
  RequestBodySize: number;
  RequestContentType: string;
  RequestContentEncoding: string;
  ResponseStatusCode: number;
  ResponseStatusText: string;
  ResponseHeaders: any;
  ResponseBody: string;
  ResponseBodySize: number;
  ResponseContentType: string;
  ResponseContentEncoding: string;
  ConfigID: string;
  ConfigSourcePath: string;
  ConfigJSON: string;
}

export interface BookmarkListResponse {
  bookmarks: ProxyBookmark[];
  total: number;
  limit: number;
  offset: number;
}
