import './styles.css';
import { loadSessionContext, state, subscribe } from './state/app-state';
import { bindLayout, requireCompany } from './components/layout';
import { toast } from './components/dom';
import { renderLogin, bindLogin } from './pages/login';
import { renderDashboard, bindDashboard } from './pages/dashboard';
import { renderHospedagens, bindHospedagens } from './pages/hospedagens';
import { renderStudios, bindStudios } from './pages/studios';
import { renderDespesas, bindDespesas } from './pages/despesas';
import { renderCash, bindCash } from './pages/cash';
import { renderNotes, bindNotes } from './pages/notes';
import { renderCompanies, bindCompanies } from './pages/companies';
import { renderUsers, bindUsers } from './pages/users';
import { renderProfile, bindProfile } from './pages/profile';

const app = document.getElementById('app')!;
let rendering = false;

async function render() {
  if (rendering) return;
  rendering = true;
  try {
    if (state.loading) {
      app.innerHTML = '<main class="loading">Carregando...</main>';
      return;
    }
    if (!state.user) {
      app.innerHTML = renderLogin();
      bindLogin();
      return;
    }
    
    // CORREÇÃO: Abre exceção para a rota de /empresas além da de /perfil
    if (!state.company && !state.route.startsWith('/perfil') && !state.route.startsWith('/empresas')) {
      app.innerHTML = requireCompany();
      bindLayout();
      return;
    }

    const route = state.route.split('?')[0];
    const refresh = () => render();
    
    // Proteger rotas administrativas
    const adminRoutes = ['/empresas', '/usuarios'];
    if (adminRoutes.includes(route) && !state.user?.is_super_admin) {
      location.hash = '/dashboard';
      return;
    }
    
    if (route === '/dashboard') {
      app.innerHTML = await renderDashboard();
      bindDashboard();
    } else if (route === '/hospedagens') {
      app.innerHTML = await renderHospedagens();
      bindHospedagens(refresh);
    } else if (route === '/studios') {
      app.innerHTML = await renderStudios();
      bindStudios(refresh);
    } else if (route === '/despesas') {
      app.innerHTML = await renderDespesas();
      bindDespesas(refresh);
    } else if (route === '/entradas-saidas') {
      app.innerHTML = await renderCash();
      bindCash(refresh);
    } else if (route === '/anotacoes') {
      app.innerHTML = await renderNotes();
      bindNotes(refresh);
    } else if (route === '/empresas') {
      app.innerHTML = await renderCompanies();
      bindCompanies(refresh);
    } else if (route === '/usuarios') {
      app.innerHTML = await renderUsers();
      bindUsers(refresh);
    } else if (route === '/perfil') {
      app.innerHTML = renderProfile();
      bindProfile();
    } else {
      location.hash = '/dashboard';
    }
    bindLayout();
  } catch (error) {
    console.error(error);
    toast(error instanceof Error ? error.message : 'Erro inesperado.', 'error');
  } finally {
    rendering = false;
  }
}

subscribe(render);
loadSessionContext();