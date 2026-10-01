declare namespace Cloudflare {
  interface Env {
    ACCESS_CODES?: string;
    SESSION_SECRET?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
