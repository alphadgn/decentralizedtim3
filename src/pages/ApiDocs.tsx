import { useEffect, useRef, useState } from "react";

const SWAGGER_VERSION = "5.17.14";
const CSS_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`;
const BUNDLE_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;
const PRESET_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-standalone-preset.js`;

const GATEWAY_BASE = `${
  import.meta.env.VITE_SUPABASE_URL ??
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
}/functions/v1/api-gateway`;

const SPEC_URL = `${GATEWAY_BASE}/openapi.json`;

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.crossOrigin = "anonymous";
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });

const ApiDocs = () => {
  const mounted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "DefiTime API Reference | Swagger UI";

    if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS_URL;
      document.head.appendChild(link);
    }

    if (mounted.current) return;
    mounted.current = true;

    (async () => {
      try {
        await loadScript(BUNDLE_URL);
        await loadScript(PRESET_URL);
        const w = window as unknown as Record<string, any>;
        w.ui = w.SwaggerUIBundle({
          url: SPEC_URL,
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [w.SwaggerUIBundle.presets.apis, w.SwaggerUIStandalonePreset],
          layout: "BaseLayout",
          docExpansion: "list",
          defaultModelsExpandDepth: 1,
          defaultModelRendering: "example",
          displayRequestDuration: true,
          tryItOutEnabled: true,
          persistAuthorization: true,
          syntaxHighlight: { activate: true, theme: "agate" },
          supportedSubmitMethods: ["get", "post"],
        });
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load API reference");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-5 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">
          DefiTime API <span className="text-muted-foreground font-normal">· v1</span>
        </h1>
        <nav className="flex flex-wrap gap-5 text-sm">
          <a className="text-primary hover:underline" href={SPEC_URL} target="_blank" rel="noreferrer">
            OpenAPI spec
          </a>
          <a className="text-primary hover:underline" href="/developer">
            Get an API key
          </a>
          <a
            className="text-primary hover:underline"
            href="mailto:decentralizedtim3@gmail.com?subject=DefiTime%20API%20support"
          >
            Support
          </a>
        </nav>
      </header>

      <section className="px-6 pt-6 max-w-4xl">
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Quick start. Every endpoint is a plain HTTPS call. Try one now — no key required:
        </p>
        <pre className="rounded-lg border border-border bg-muted/40 p-4 overflow-x-auto text-xs leading-relaxed">
          <code>{`curl -s "${GATEWAY_BASE}/v1/time"`}</code>
        </pre>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
          Authenticate with <code>Authorization: Bearer dgtn_live_...</code> for higher limits and richer
          responses. Responses carry <code>RateLimit-*</code> headers and <code>X-Request-Id</code> for support.
        </p>
      </section>

      {error && (
        <p className="px-6 py-8 text-sm text-destructive">{error}</p>
      )}
      {!ready && !error && (
        <p className="px-6 py-8 text-sm text-muted-foreground">Loading API reference…</p>
      )}
      {/* Swagger UI ships a light theme; give it a white canvas so its text is legible */}
      <style>{`
        .swagger-canvas { background: #ffffff; color: #3b4151; border-radius: 0.75rem; }
        .swagger-canvas .swagger-ui { color: #3b4151; }
        .swagger-canvas .swagger-ui .info .title,
        .swagger-canvas .swagger-ui .info p,
        .swagger-canvas .swagger-ui .info li,
        .swagger-canvas .swagger-ui .opblock-tag,
        .swagger-canvas .swagger-ui .opblock .opblock-summary-path,
        .swagger-canvas .swagger-ui .opblock .opblock-summary-description,
        .swagger-canvas .swagger-ui table thead tr th,
        .swagger-canvas .swagger-ui .model-title,
        .swagger-canvas .swagger-ui .model,
        .swagger-canvas .swagger-ui label,
        .swagger-canvas .swagger-ui h1,
        .swagger-canvas .swagger-ui h2,
        .swagger-canvas .swagger-ui h3,
        .swagger-canvas .swagger-ui h4,
        .swagger-canvas .swagger-ui h5 { color: #3b4151; }
        .swagger-canvas .swagger-ui .info a { color: #4990e2; }
      `}</style>
      <div className="max-w-[78rem] mx-auto px-2 py-6">
        <div id="swagger-ui" className="swagger-canvas p-2" />
      </div>
    </div>
  );
};

export default ApiDocs;
