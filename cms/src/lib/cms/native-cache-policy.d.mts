export function isNativeProofPath(path: string): boolean;
export function validateProofTags(tags: unknown): string[];
export function scopedCloudflareProvider(nativeProvider: Record<string, unknown>, purge: (tags: string[]) => Promise<{success: boolean}>): Record<string, unknown>;

export function forwardNativeProof(entrypoint: {fetch(request: Request, options?: {cache:'no-store'}): Promise<Response>}, request: Request): Promise<Response>;
export function privateProofResponse(request: Request, response: Response): boolean;
