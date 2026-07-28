/**
 * Swagger UI shell for the public API reference.
 *
 * Assets are pinned to an exact version rather than a floating tag so the docs
 * page cannot change under us — and so the CSP below stays meaningful.
 */

const SWAGGER_VERSION = "5.17.14";
const SWAGGER_BASE = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}`;

export const DOCS_CSP = [
  "default-src 'self'",
  `script-src 'unsafe-inline' ${SWAGGER_BASE}`,
  `style-src 'unsafe-inline' ${SWAGGER_BASE}`,
  `img-src 'self' data: ${SWAGGER_BASE}`,
  `font-src 'self' data: ${SWAGGER_BASE}`,
  "connect-src *",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

export function renderDocsPage(specUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DefiTime API Reference</title>
<meta name="description" content="REST API reference for DefiTime — verifiable consensus time and tamper-evident event ordering.">
<link rel="stylesheet" href="${SWAGGER_BASE}/swagger-ui.css">
<style>
  :root {
    --dt-bg: #ffffff;
    --dt-fg: #0b1220;
    --dt-muted: #5b6474;
    --dt-accent: #2f6df6;
    --dt-border: #e3e8f0;
    --dt-code-bg: #f5f7fb;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --dt-bg: #0b1220;
      --dt-fg: #e8ecf4;
      --dt-muted: #97a1b5;
      --dt-accent: #6f9bff;
      --dt-border: #1e2940;
      --dt-code-bg: #131c2e;
    }
  }

  body { margin: 0; background: var(--dt-bg); color: var(--dt-fg);
         font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }

  .dt-header {
    border-bottom: 1px solid var(--dt-border);
    padding: 1.5rem clamp(1rem, 4vw, 3rem);
    display: flex; flex-wrap: wrap; gap: 1rem 2rem;
    align-items: baseline; justify-content: space-between;
  }
  .dt-title { font-size: 1.25rem; font-weight: 650; letter-spacing: -0.01em; }
  .dt-title span { color: var(--dt-muted); font-weight: 450; }
  .dt-links { display: flex; flex-wrap: wrap; gap: 1.25rem; font-size: .875rem; }
  .dt-links a { color: var(--dt-accent); text-decoration: none; }
  .dt-links a:hover { text-decoration: underline; }

  .dt-start {
    padding: 1.25rem clamp(1rem, 4vw, 3rem) 0;
    max-width: 62rem;
  }
  .dt-start p { color: var(--dt-muted); font-size: .9375rem; line-height: 1.6; margin: 0 0 .75rem; }
  .dt-start pre {
    background: var(--dt-code-bg); border: 1px solid var(--dt-border);
    border-radius: .5rem; padding: .875rem 1rem; overflow-x: auto;
    font-size: .8125rem; line-height: 1.55; margin: 0 0 .5rem;
  }
  .dt-start code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

  /* Swagger UI ships a light theme; nudge it to follow the page in dark mode. */
  @media (prefers-color-scheme: dark) {
    .swagger-ui, .swagger-ui .info .title, .swagger-ui .info li,
    .swagger-ui .info p, .swagger-ui .info table, .swagger-ui label,
    .swagger-ui .model-title, .swagger-ui .model,
    .swagger-ui table thead tr td, .swagger-ui table thead tr th,
    .swagger-ui .opblock .opblock-summary-description,
    .swagger-ui .opblock-description-wrapper p,
    .swagger-ui .opblock-tag, .swagger-ui .parameter__name,
    .swagger-ui .parameter__type, .swagger-ui .response-col_status,
    .swagger-ui .response-col_description { color: var(--dt-fg); }
    .swagger-ui .scheme-container, .swagger-ui section.models,
    .swagger-ui .opblock .opblock-section-header { background: var(--dt-code-bg); box-shadow: none; }
    .swagger-ui .opblock { border-color: var(--dt-border); }
    .swagger-ui .opblock .opblock-summary { border-color: var(--dt-border); }
    .swagger-ui input[type=text], .swagger-ui textarea {
      background: var(--dt-code-bg); color: var(--dt-fg); border-color: var(--dt-border);
    }
    .swagger-ui .microlight { background: #0d1526 !important; }
  }

  #swagger-ui { max-width: 78rem; margin: 0 auto; }
</style>
</head>
<body>

<header class="dt-header">
  <div class="dt-title">DefiTime API <span>· v1</span></div>
  <nav class="dt-links">
    <a href="${specUrl}">OpenAPI spec</a>
    <a href="https://defitime.io/dashboard">Get an API key</a>
    <a href="mailto:decentralizedtim3@gmail.com?subject=DefiTime%20API%20support">Support</a>
  </nav>
</header>

<section class="dt-start">
  <p><strong>Quick start.</strong> Every endpoint is a plain HTTPS call. Try one now — no key required:</p>
  <pre><code>curl -s "${specUrl.replace(/\/openapi\.json$/, "/v1/time")}"</code></pre>
  <p>
    Authenticate with <code>Authorization: Bearer dgtn_live_...</code> for higher limits and
    richer responses. Responses carry <code>RateLimit-*</code> headers so you can pace
    requests, and <code>X-Request-Id</code> for support. Full details are in the
    description below.
  </p>
</section>

<div id="swagger-ui"></div>

<script src="${SWAGGER_BASE}/swagger-ui-bundle.js" crossorigin="anonymous"></script>
<script src="${SWAGGER_BASE}/swagger-ui-standalone-preset.js" crossorigin="anonymous"></script>
<script>
  window.addEventListener('load', function () {
    window.ui = SwaggerUIBundle({
      url: ${JSON.stringify(specUrl)},
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
      defaultModelRendering: 'example',
      displayRequestDuration: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
      syntaxHighlight: { activate: true, theme: 'agate' },
      supportedSubmitMethods: ['get', 'post'],
    });
  });
</script>
</body>
</html>`;
}
