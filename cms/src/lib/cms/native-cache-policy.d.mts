export function isNativeProofPath(path: string): boolean;
export function validateProofTags(tags: unknown): string[];
export function scopedCloudflareProvider(nativeProvider: Record<string, unknown>, purge: (tags: string[]) => Promise<{success: boolean}>): Record<string, unknown>;
