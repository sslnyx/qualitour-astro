/// <reference types="astro/client" />

interface ImportMetaEnv {
    readonly PUBLIC_WORDPRESS_CUSTOM_API_URL: string;
    readonly PUBLIC_WORDPRESS_API_URL: string;
    readonly PUBLIC_ASSETS_URL: string;
    readonly WORDPRESS_API_URL: string;
    readonly WORDPRESS_AUTH_USER: string;
    readonly WORDPRESS_AUTH_PASS: string;
    readonly ZAUI_API_URL: string;
    readonly ZAUI_API_TOKEN: string;
    readonly ZAUI_ACCOUNT_ID: string;
    readonly ZAUI_USER_ID: string;
    readonly ZAUI_WEBHOOK_SECRET_UPDATE: string;
    readonly ZAUI_WEBHOOK_SECRET_CREATE: string;
    readonly ZAUI_WEBHOOK_SECRET_DELETE: string;
    readonly CF_DEPLOY_HOOK_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
