// Type declarations for @vercel/node (installed by Vercel during build)
declare module "@vercel/node" {
  export interface VercelRequest {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    body?: any;
    query?: Record<string, string | string[]>;
    cookies?: Record<string, string>;
  }

  export interface VercelResponse {
    status(code: number): VercelResponse;
    json(body: any): VercelResponse;
    send(body: any): VercelResponse;
    setHeader(name: string, value: string | string[]): VercelResponse;
    getHeader(name: string): string | string[] | undefined;
    headersSent: boolean;
  }
}




