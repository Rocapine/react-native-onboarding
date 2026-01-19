import React, { useEffect, useRef } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';

declare global {
  interface Window {
    SwaggerUIBundle: any;
    SwaggerUIStandalonePreset: any;
  }
}

export default function ApiDocs(): React.ReactElement {
  const swaggerRef = useRef<HTMLDivElement>(null);
  const openApiUrl = useBaseUrl('/openapi.yaml');
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !swaggerRef.current) return;

    // Load Swagger UI CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css';
    document.head.appendChild(link);

    // Load Swagger UI bundle
    const bundleScript = document.createElement('script');
    bundleScript.src = 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js';
    bundleScript.async = true;

    // Load standalone preset
    const presetScript = document.createElement('script');
    presetScript.src = 'https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js';
    presetScript.async = true;

    const initSwagger = () => {
      if (
        window.SwaggerUIBundle &&
        window.SwaggerUIStandalonePreset &&
        swaggerRef.current &&
        !initializedRef.current
      ) {
        initializedRef.current = true;

        // Clear container
        swaggerRef.current.innerHTML = '';

        window.SwaggerUIBundle({
          url: openApiUrl,
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            window.SwaggerUIBundle.presets.apis,
            window.SwaggerUIStandalonePreset,
          ],
          plugins: [
            window.SwaggerUIBundle.plugins.DownloadUrl,
          ],
          layout: 'StandaloneLayout',
          tryItOutEnabled: true,
          supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
          validatorUrl: null,
          docExpansion: 'list',
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
        });
      }
    };

    // Wait for both scripts to load
    let bundleLoaded = false;
    let presetLoaded = false;

    bundleScript.onload = () => {
      bundleLoaded = true;
      if (presetLoaded) initSwagger();
    };

    presetScript.onload = () => {
      presetLoaded = true;
      if (bundleLoaded) initSwagger();
    };

    document.body.appendChild(bundleScript);
    document.body.appendChild(presetScript);

    return () => {
      if (bundleScript.parentNode) {
        bundleScript.parentNode.removeChild(bundleScript);
      }
      if (presetScript.parentNode) {
        presetScript.parentNode.removeChild(presetScript);
      }
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      initializedRef.current = false;
    };
  }, [openApiUrl]);

  return (
    <Layout title="API Documentation" description="Interactive OpenAPI documentation with Swagger UI">
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: '#2c3e50',
        color: 'white',
        padding: '1rem 2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
            Onboarding Studio API
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
            Complete OpenAPI 3.0 specification with interactive testing
          </p>
          <Link
            to="/docs/api-openapi"
            style={{
              color: '#61dafb',
              textDecoration: 'none',
              marginTop: '0.5rem',
              display: 'inline-block'
            }}
          >
            ← Back to Documentation
          </Link>
        </div>
      </div>
      <div
        id="swagger-ui"
        ref={swaggerRef}
        style={{
          marginTop: '120px',
          padding: '2rem',
          minHeight: 'calc(100vh - 120px)',
          backgroundColor: 'white',
        }}
      />
    </Layout>
  );
}
