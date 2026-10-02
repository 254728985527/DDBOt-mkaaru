import { website_name } from '@/utils/site-config';
import { domain_app_ids, getAppId, getCurrentProductionDomain } from '../config/config';
import { CookieStorage, isStorageSupported, LocalStore } from '../storage/storage';
import { getStaticUrl, urlForCurrentDomain } from '../url';
import { deriv_urls } from '../url/constants';

export const redirectToLogin = (is_logged_in: boolean, language: string, has_params = true, redirect_delay = 0) => {
    if (!is_logged_in && isStorageSupported(sessionStorage)) {
        const l = window.location;
        const redirect_url = has_params ? window.location.href : `${l.protocol}//${l.host}${l.pathname}`;
        sessionStorage.setItem('redirect_url', redirect_url);
        setTimeout(() => {
            const new_href = loginUrl({ language });
            window.location.href = new_href;
        }, redirect_delay);
    }
};

export const redirectToSignUp = () => {
    window.open(getStaticUrl('/signup/'));
};

type TLoginUrl = {
    language: string;
};

const toBase64Url = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

const createRandomString = (length: number) => {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
};

export const redirectToDerivOAuthLogin = async (language = 'en') => {
    const client_id = getAppId();
    if (!client_id) {
        throw new Error('Deriv OAuth client_id is not configured');
    }

    const code_verifier = createRandomString(64);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code_verifier));
    const code_challenge = toBase64Url(new Uint8Array(digest));
    const state = createRandomString(32);
    const redirect_uri = `${window.location.origin}/callback`;

    sessionStorage.setItem('pkce_code_verifier', code_verifier);
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id,
        redirect_uri,
        scope: 'trade account_manage application_read payment',
        state,
        code_challenge,
        code_challenge_method: 'S256',
    });

    window.location.assign(`https://auth.deriv.com/oauth2/auth?${params.toString()}`);
};

export const loginUrl = ({ language }: TLoginUrl) => {
    const server_url = LocalStore.get('config.server_url');
    const signup_device_cookie = new (CookieStorage as any)('signup_device');
    const signup_device = signup_device_cookie.get('signup_device');
    const date_first_contact_cookie = new (CookieStorage as any)('date_first_contact');
    const date_first_contact = date_first_contact_cookie.get('date_first_contact');
    const marketing_queries = `${signup_device ? `&signup_device=${signup_device}` : ''}${
        date_first_contact ? `&date_first_contact=${date_first_contact}` : ''
    }`;
    const getOAuthUrl = () => {
        const current_domain = getCurrentProductionDomain();
        let oauth_domain = deriv_urls.DERIV_HOST_NAME;

        if (current_domain) {
            // Extract domain suffix (e.g., 'deriv.me' from 'dbot.deriv.me')
            const domain_suffix = current_domain.replace(/^[^.]+\./, '');
            oauth_domain = domain_suffix;
        }

        const url = `https://oauth.${oauth_domain}/oauth2/authorize?app_id=${getAppId()}&l=${language}${marketing_queries}&brand=${website_name.toLowerCase()}`;
        return url;
    };

    if (server_url && /qa/.test(server_url)) {
        return `https://${server_url}/oauth2/authorize?app_id=${getAppId()}&l=${language}${marketing_queries}&brand=${website_name.toLowerCase()}`;
    }

    if (getAppId() === domain_app_ids[window.location.hostname as keyof typeof domain_app_ids]) {
        return getOAuthUrl();
    }
    return urlForCurrentDomain(getOAuthUrl());
};
