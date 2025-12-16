/// <reference types="astro/client" />

interface ImportMetaEnv {
    readonly PUBLIC_WORDPRESS_API_URL: string;
    readonly PUBLIC_ASSETS_URL: string;
    readonly WORDPRESS_API_URL: string;
    readonly WORDPRESS_AUTH_USER: string;
    readonly WORDPRESS_AUTH_PASS: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
