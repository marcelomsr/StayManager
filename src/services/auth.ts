export type GoogleUser = {
  id: string;
  email: string;
  name: string;
  picture?: string;
};

const STORAGE_KEY = 'staymanager_google_user';

function decodeJwtPayload<T>(jwt: string): T | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)) as T;
  } catch {
    return null;
  }
}

async function loadGoogleIdentityScript() {
  if ((window as any).google?.accounts?.id) return;

  return new Promise<void>((resolve, reject) => {
    const src = 'https://accounts.google.com/gsi/client';
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google Identity Services.')));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar Google Identity Services.'));
    document.head.appendChild(script);
  });
}

export function getSessionUser(): GoogleUser | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GoogleUser) : null;
  } catch {
    return null;
  }
}

export async function setupGoogleLogin(onLogin: () => void) {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!googleClientId) {
    throw new Error('Configure VITE_GOOGLE_CLIENT_ID no arquivo .env.');
  }

  await loadGoogleIdentityScript();

  (window as any).google.accounts.id.initialize({
    client_id: googleClientId,
    ux_mode: 'popup',
    callback: (response: any) => {
      const payload = decodeJwtPayload<{ sub: string; email: string; name: string; picture?: string }>(
        response.credential
      );

      if (!payload?.email) {
        throw new Error('Não foi possível obter seu e-mail do Google.');
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          id: payload.sub,
          email: payload.email.toLowerCase(),
          name: payload.name,
          picture: payload.picture
        })
      );
      onLogin();
    }
  });
}

export function promptGoogleLogin() {
  (window as any).google.accounts.id.prompt();
}

export async function signOut() {
  sessionStorage.removeItem('staymanager.company_id');
  window.localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}
