# StayManager

Sistema Vite + TypeScript + HTML + CSS para gerenciar hospedagens com Google Identity Services no navegador e Supabase PostgreSQL.

## Instalação

1. Instale as dependências:

```bash
npm install
```

2. Copie o ambiente:

```bash
cp .env.example .env
```

3. Preencha no `.env`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publishable
VITE_GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com
```

Use o mesmo `VITE_GOOGLE_CLIENT_ID` ja configurado no projeto de gestao financeira, se ele ja estiver funcionando para localhost.

4. No Supabase SQL Editor, execute o arquivo [supabase/schema.sql](/home/marcelosilvaribeiro/repos/personal/StayManager/supabase/schema.sql).

5. Rode localmente:

```bash
npm run dev
```

Para atualizar um banco existente para o quadro de anotações com edição direta e
ordenação por arraste, execute
[`supabase/migrations/20261112_notes_board.sql`](supabase/migrations/20261112_notes_board.sql)
no SQL Editor do Supabase antes de usar a nova versão. A migração preserva os
textos e a ordem atual; novas anotações aparecem primeiro e as mudanças de ordem
ficam salvas por empresa. O schema completo já inclui essa atualização.

## Regras principais

- Login com Google Identity Services, igual ao projeto de gestao financeira.
- O usuario autenticado fica salvo em `localStorage`.
- O primeiro login registra/atualiza o e-mail em `app_users`.
- `marcelosr6@gmail.com` vira super admin no carregamento do app.
- Todos os dados operacionais usam `company_id`.
- A empresa selecionada fica salva em `sessionStorage`.
- As policies do schema liberam acesso `anon`, seguindo o mesmo modelo simples do projeto de gestao financeira.
- Studios, Hospedagens, Empresas, Anotações e Tipos de Despesas usam exclusão lógica.
- O banco impede hospedagens sobrepostas para o mesmo studio por constraint `exclude`.
- Datas e horas devem ser lançadas no horário local `America/Sao_Paulo`; o Supabase armazena em `timestamptz`.
