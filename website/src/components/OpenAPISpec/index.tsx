import React, { useEffect, useRef } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';

declare global {
  interface Window {
    Redoc: any;
  }
}

export default function OpenAPISpec(): JSX.Element {
  const redocRef = useRef<HTMLDivElement>(null);
  const openApiUrl = useBaseUrl('/openapi.yaml');
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !redocRef.current) return;

    // Load Redoc CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/redoc@2.1.3/bundles/redoc.standalone.css';
    document.head.appendChild(link);

    // Load Redoc script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/redoc@2.1.3/bundles/redoc.standalone.js';
    script.async = true;

    script.onload = () => {
      if (window.Redoc && redocRef.current && !initializedRef.current) {
        initializedRef.current = true;
        
        // Clear container
        redocRef.current.innerHTML = '';
        
        window.Redoc.init(openApiUrl, {
          scrollYOffset: 60,
          hideDownloadButton: false,
          theme: {
            colors: {
              primary: {
                main: '#1890ff',
              },
            },
            typography: {
              fontSize: '14px',
              lineHeight: '1.5em',
              code: {
                fontSize: '13px',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              },
            },
          },
        }, redocRef.current);
      }
    };

    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      initializedRef.current = false;
    };
  }, [openApiUrl]);

  return (
    <div style={{ marginTop: '2rem' }}>
      <div ref={redocRef} style={{ minHeight: '600px' }} />
    </div>
  );
}
