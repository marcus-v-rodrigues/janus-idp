import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { Response } from 'express';

interface RenderViewOptions {
  title?: string;
  description?: string;
  customHead?: string;
}

/**
 * Renderiza um componente React para HTML estático e envia como resposta.
 * Usa ReactDOMServer.renderToStaticMarkup para renderização no servidor sem hidratação.
 *
 * @param res - Objeto de resposta Express
 * @param Component - Componente funcional React para renderizar
 * @param props - Props para passar ao componente
 * @param options - Metadados HTML opcionais (título, descrição, elementos head personalizados)
 */
export function renderView<T extends Record<string, any>>(
  res: Response,
  Component: React.FC<T>,
  props: T,
  options: RenderViewOptions = {}
): void {
  const { title = 'Janus IDP', description = 'OpenID Connect Provider', customHead = '' } = options;

  // Renderiza o componente React para marcação estática
  const componentHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Component, props)
  );

  // Constrói o documento HTML completo
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <script src="https://cdn.tailwindcss.com"></script>
  ${customHead}
</head>
<body>
  ${componentHtml}
</body>
</html>`;

  res.send(html);
}

/**
 * Escapa caracteres especiais HTML para prevenir XSS.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
