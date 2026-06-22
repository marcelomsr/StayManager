import { promptGoogleLogin, setupGoogleLogin } from '../services/auth';

export function renderLogin() {
  return `
    <main class="login-page">
      <section class="login-panel">
        <h1>StayManager</h1>
        <p>Gestão simples de hospedagens, despesas e caixa por studio.</p>
        <p id="login-error" class="login-error" hidden></p>
        <button id="google-login" class="primary full" disabled>Entrar com Google</button>
      </section>
    </main>
  `;
}

export function bindLogin() {
  const button = document.getElementById('google-login') as HTMLButtonElement | null;
  const errorBox = document.getElementById('login-error') as HTMLParagraphElement | null;
  if (!button || !errorBox) return;

  setupGoogleLogin(() => window.location.reload())
    .then(() => {
      button.disabled = false;
    })
    .catch((error) => {
      errorBox.textContent = error instanceof Error ? error.message : String(error);
      errorBox.hidden = false;
    });

  button.addEventListener('click', () => {
    errorBox.hidden = true;
    try {
      promptGoogleLogin();
    } catch (error) {
      errorBox.textContent = error instanceof Error ? error.message : String(error);
      errorBox.hidden = false;
    }
  });
}
