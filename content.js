// Detección inteligente de errores en páginas web
class CodeErrorDetector {
  constructor() {
    this.errors = [];
    this.detectedErrors = [];
    console.log('🔍 Code Error Detector iniciado');
    this.detectErrors();
  }

  detectErrors() {
    this.detectJavaScriptErrors();
    this.detectCSSErrors();
    this.detectHTMLErrors();
    this.sendErrorsToPopup();
  }

  // Detectar errores de JavaScript en scripts de la página
  detectJavaScriptErrors() {
    const scripts = document.querySelectorAll('script');
    console.log(`📜 Encontrados ${scripts.length} scripts en la página`);
    
    scripts.forEach((script, index) => {
      if (script.src) {
        // Scripts externos - monitorear errores de carga
        script.onerror = () => {
          const errorMsg = `JavaScript Error: Failed to load external script: ${script.src}`;
          this.errors.push(errorMsg);
          console.error(errorMsg);
        };
      } else {
        // Scripts inline - intentar analizar sintaxis básica
        try {
          if (script.textContent.trim()) {
            this.analyzeInlineScript(script.textContent, index);
          }
        } catch (e) {
          const errorMsg = `JavaScript Syntax Error: ${e.message}`;
          this.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
    });

    // Monitorear errores globales de JavaScript
    window.addEventListener('error', (e) => {
      const errorMsg = `Runtime Error: ${e.message} at ${e.filename}:${e.lineno}`;
      this.errors.push(errorMsg);
      console.error('Window error:', errorMsg);
      this.sendErrorsToPopup();
    });

    // Monitorear promesas rechazadas
    window.addEventListener('unhandledrejection', (e) => {
      const errorMsg = `Unhandled Promise Rejection: ${e.reason}`;
      this.errors.push(errorMsg);
      console.error('Unhandled rejection:', errorMsg);
      this.sendErrorsToPopup();
    });
  }

  analyzeInlineScript(code, scriptIndex) {
    // Patrones comunes de errores de sintaxis
    const errorPatterns = [
      { pattern: /console\.log\([^)]*$/, message: "Console.log sin cerrar paréntesis" },
      { pattern: /function\s+\w+\s*\([^)]*$/, message: "Función sin cerrar paréntesis" },
      { pattern: /if\s*\([^)]*$/, message: "Condición if sin cerrar" },
      { pattern: /for\s*\([^)]*$/, message: "Bucle for sin cerrar paréntesis" },
      { pattern: /const\s+\w+\s*=\s*$/, message: "Constante declarada sin valor" },
      { pattern: /let\s+\w+\s*=\s*$/, message: "Variable let declarada sin valor" },
      { pattern: /var\s+\w+\s*=\s*$/, message: "Variable var declarada sin valor" },
      { pattern: /['"`][^'"`]*$/, message: "String sin cerrar" },
      { pattern: /\/\/[^\n]*$/, message: "Comentario sin cerrar línea" },
      { pattern: /\/\*[^*]*$/, message: "Comentario multilínea sin cerrar" },
      { pattern: /{[^}]*$/, message: "Llave sin cerrar" },
      { pattern: /\([^)]*$/, message: "Paréntesis sin cerrar" },
      { pattern: /\[[^\]]*$/, message: "Corchete sin cerrar" }
    ];

    const lines = code.split('\n');
    lines.forEach((line, lineIndex) => {
      errorPatterns.forEach(({ pattern, message }) => {
        if (pattern.test(line)) {
          const errorMsg = `JavaScript Pattern: ${message} (Línea ${lineIndex + 1})`;
          this.errors.push(errorMsg);
        }
      });
    });

    // Detectar eval peligrosos
    if (code.includes('eval(') && !code.includes('// safe eval')) {
      this.errors.push('Security: Uso de eval() detectado - Puede ser peligroso');
    }

    // Detectar innerHTML sin sanitizar
    if (code.includes('.innerHTML') && !code.includes('DOMPurify') && !code.includes('sanitize')) {
      this.errors.push('Security: innerHTML sin sanitización - Riesgo de XSS');
    }
  }

  // Detectar problemas de CSS
  detectCSSErrors() {
    try {
      const stylesheets = document.styleSheets;
      console.log(`🎨 Encontrados ${stylesheets.length} stylesheets`);
      
      Array.from(stylesheets).forEach((sheet, sheetIndex) => {
        try {
          const rules = sheet.cssRules || [];
          Array.from(rules).forEach((rule, ruleIndex) => {
            if (rule.style) {
              // Verificar propiedades CSS inválidas
              Array.from(rule.style).forEach(prop => {
                const value = rule.style[prop];
                if (value === '' || value === null || value === undefined) {
                  const errorMsg = `CSS Error: Propiedad vacía '${prop}' en ${rule.selectorText || 'unknown selector'}`;
                  this.errors.push(errorMsg);
                }
                
                // Detectar valores inválidos comunes
                if (value === 'undefined' || value === 'null' || value === 'NaN') {
                  const errorMsg = `CSS Error: Valor inválido '${value}' para propiedad '${prop}'`;
                  this.errors.push(errorMsg);
                }
              });
            }
          });
        } catch (e) {
          const errorMsg = `CSS Error: No se puede leer stylesheet - ${e.message}`;
          this.errors.push(errorMsg);
          console.error('CSS Error:', errorMsg);
        }
      });
    } catch (e) {
      const errorMsg = `CSS Error general: ${e.message}`;
      this.errors.push(errorMsg);
      console.error('CSS General Error:', errorMsg);
    }
  }

  // Detectar problemas de HTML y accesibilidad
  detectHTMLErrors() {
    // Imágenes sin alt
    const images = document.querySelectorAll('img');
    let missingAltCount = 0;
    images.forEach(img => {
      if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
        missingAltCount++;
      }
    });
    if (missingAltCount > 0) {
      this.errors.push(`Accessibility: ${missingAltCount} imágenes sin atributo alt`);
    }

    // Links sin texto
    const links = document.querySelectorAll('a');
    let emptyLinksCount = 0;
    links.forEach(link => {
      if (!link.textContent.trim() && !link.querySelector('img, svg')) {
        emptyLinksCount++;
      }
    });
    if (emptyLinksCount > 0) {
      this.errors.push(`Accessibility: ${emptyLinksCount} enlaces sin texto descriptivo`);
    }

    // Formularios sin labels
    const inputs = document.querySelectorAll('input, textarea, select');
    let unlabeledInputsCount = 0;
    inputs.forEach(input => {
      if (input.type !== 'hidden' && !input.hasAttribute('aria-label') && !input.hasAttribute('placeholder')) {
        if (!input.id || !document.querySelector(`label[for="${input.id}"]`)) {
          unlabeledInputsCount++;
        }
      }
    });
    if (unlabeledInputsCount > 0) {
      this.errors.push(`Accessibility: ${unlabeledInputsCount} campos de formulario sin etiqueta`);
    }

    // Headings sin estructura jerárquica
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length > 0) {
      const firstHeading = headings[0].tagName;
      if (firstHeading !== 'H1') {
        this.errors.push('Accessibility: La página no comienza con H1 - Problema de estructura de encabezados');
      }
    }

    console.log(`🌐 Análisis de accesibilidad: ${images.length} imágenes, ${links.length} enlaces, ${inputs.length} inputs`);
  }

  sendErrorsToPopup() {
    // Eliminar duplicados
    const uniqueErrors = [...new Set(this.errors)];
    
    if (uniqueErrors.length > 0) {
      console.log(`📤 Enviando ${uniqueErrors.length} errores al popup:`, uniqueErrors);
      
      chrome.runtime.sendMessage({ 
        errors: uniqueErrors,
        timestamp: new Date().toLocaleTimeString(),
        url: window.location.href
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
        } else {
          console.log('Message sent successfully');
        }
      });
    }
  }
}

// Función global para obtener código de la página para análisis IA
function getPageCodeForAnalysis() {
  const pageInfo = {
    url: window.location.href,
    title: document.title,
    html: document.documentElement.outerHTML.substring(0, 5000),
    scripts: Array.from(document.scripts).map((script, index) => 
      script.src ? 
        `External Script ${index}: ${script.src}` : 
        `Inline Script ${index}: ${script.textContent.substring(0, 200)}...`
    ),
    stylesheets: Array.from(document.styleSheets).length,
    images: document.images.length,
    errors: window.detectedErrors || []
  };
  
  return JSON.stringify(pageInfo, null, 2);
}

// Inicializar el detector cuando se carga la página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando Code Error Detector...');
    window.codeDetector = new CodeErrorDetector();
  });
} else {
  console.log('🚀 Inicializando Code Error Detector (document already ready)...');
  window.codeDetector = new CodeErrorDetector();
}

// También detectar errores en dynamically loaded content
new MutationObserver(() => {
  setTimeout(() => {
    if (window.codeDetector) {
      window.codeDetector.detectErrors();
    }
  }, 2000);
}).observe(document.body, { childList: true, subtree: true });

// Exponer detector globalmente para debugging
window.detectedErrors = [];
window.getDetectedErrors = function() {
  return window.codeDetector ? window.codeDetector.errors : [];
};

