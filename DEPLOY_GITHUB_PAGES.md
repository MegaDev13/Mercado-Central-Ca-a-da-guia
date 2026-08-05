# Deploy GitHub Pages - Passo rápido

## 1. Build local já está pronto em dist/
Este projeto já foi buildado (npm run build) e a pasta dist/ está pronta para GitHub Pages.

Arquivos:
- dist/index.html (759 bytes)
- dist/assets/*.js/css (2.3MB total)

## 2. Opção A - Upload manual
- Crie repositório no GitHub, ex: ravenport-companhia
- Faça push do código todo (branch main)
- Rode `npm run deploy` (usa gh-pages) -> cria branch gh-pages com conteúdo dist/
- GitHub Settings -> Pages -> Source: gh-pages / root

## 3. Opção B - Actions automático (recomendado com Supabase)
- Já existe .github/workflows/deploy.yml
- Adicione Secrets em Settings -> Secrets -> Actions:
  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- Dê push para main -> Actions builda e publica automaticamente

## 4. Sem Supabase (só local)
- Funciona igual, só não configurar secrets e não ter .env
- Dados ficam em localStorage do navegador de cada um (modo PC local)

## 5. Com Supabase
- Siga docs/SUPABASE_TUTORIAL_COMPLETO.md
- Rode SQL de supabase/schema_completo.sql no SQL Editor
- Configure env e secrets
