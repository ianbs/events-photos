SPEC.md — Galeria Colaborativa de Fotos para Batizado

1. Visão geral

Este projeto é uma aplicação web mobile-first para uso em um batizado.

Os convidados acessarão a aplicação por meio de um QR Code. Ao abrir o link no celular, poderão tirar fotos usando a câmera do próprio aparelho, enviar essas fotos para a aplicação e visualizar apenas as fotos que foram feitas a partir daquele dispositivo/navegador.

O administrador do evento terá uma área protegida por autenticação para visualizar todas as fotos enviadas, abrir os arquivos originais, fazer download e excluir imagens.

O projeto deve priorizar:

simplicidade de uso;

boa experiência em celulares;

compatibilidade com iPhone e Android;

segurança;

estabilidade no dia do evento;

baixo custo operacional;

facilidade de deploy e manutenção;

possibilidade de reutilização futura para outros eventos.

2. Objetivo do MVP

O MVP deve permitir o seguinte fluxo:

QR Code
   ↓
Página do evento
   ↓
Tirar foto
   ↓
Preview
   ↓
Enviar
   ↓
Foto armazenada
   ↓
Convidado vê suas próprias fotos

O administrador deve conseguir:

Login
   ↓
Painel administrativo
   ↓
Visualizar todas as fotos
   ↓
Abrir original / baixar / excluir

3. Fora do escopo inicial

Não implementar no MVP:

aplicativo nativo iOS;

aplicativo nativo Android;

cadastro de convidados;

login para convidados;

comentários;

curtidas;

reconhecimento facial;

edição de fotos;

filtros de imagem;

impressão de fotos;

integração com redes sociais;

slideshow ao vivo;

download em ZIP de todas as fotos;

múltiplos administradores com papéis diferentes;

notificações push;

AWS;

servidor dedicado;

Kubernetes;

Docker obrigatório para produção;

sincronização automática com Google Drive;

inteligência artificial para classificação de fotos.

Esses itens podem ser considerados em versões futuras.

4. Stack técnica

Frontend

Next.js

React

TypeScript

Tailwind CSS

Preferir a versão estável atual do Next.js no momento da implementação.

Usar App Router.

Backend

Usar as capacidades server-side do próprio Next.js quando necessário.

Evitar criar um backend separado.

Banco de dados

Supabase PostgreSQL.

Armazenamento de imagens

Supabase Storage.

Autenticação

Supabase Auth apenas para o administrador.

Hospedagem

Vercel.

Código-fonte

GitHub.