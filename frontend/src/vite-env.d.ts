/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_FACEBOOK_APP_ID: string;
    // Add more env variables here as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
