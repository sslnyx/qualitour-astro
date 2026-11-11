export type DeploymentTarget = 'staging' | 'production';

/** Public site settings only. Hosting credentials never belong in this module. */
export function deploymentConfig(target: string = 'staging') {
    if (target !== 'staging' && target !== 'production') {
        throw new Error(`Unknown deployment target: ${target}`);
    }
    return {
        target: target as DeploymentTarget,
        origin: 'https://qualitour.ca',
        base: target === 'staging' ? '/staging' : '/',
        indexable: target === 'production',
        wordpressApi: 'https://qualitour.ca/wp-json/qualitour/v1',
    };
}
