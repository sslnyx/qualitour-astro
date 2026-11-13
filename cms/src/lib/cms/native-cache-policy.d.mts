export function isNativeProofPath(path: string): boolean;
export function validateProofTags(tags: unknown): string[];
export function scopedCloudflareProvider(nativeProvider: Record<string, unknown>, purge: (tags: string[]) => Promise<{success: boolean}>): Record<string, unknown>;

export function forwardNativeProof(entrypoint: {fetch(request: Request, options?: {cache?:'no-store';cf?:{cacheKey:string}}): Promise<Response>}, request: Request): Promise<Response>;
export function privateProofResponse(request: Request, response: Response): boolean;
export function withStaticFallback(request: Request, response: Response, assets: {fetch(request: Request): Promise<Response>} | undefined): Promise<Response>;
