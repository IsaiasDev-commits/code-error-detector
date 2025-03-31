const errors = [];
const cssErrors = [];
const accessibilityErrors = [];

// Verificar errores de sintaxis en JavaScript
try {
  eval("let x = ;");  // Error de sintaxis para pruebas
} catch (e) {
  if (e instanceof SyntaxError) {
    errors.push("Syntax error in JavaScript: " + e.message);
  }
}

// Detectar errores en CSS (Propiedades inválidas)
const stylesheets = document.styleSheets;
try {
  Array.from(stylesheets).forEach(sheet => {
    try {
      Array.from(sheet.cssRules).forEach(rule => {
        if (rule.style && rule.style.length > 0) {
          Array.from(rule.style).forEach(prop => {
            if (!rule.style[prop]) {
              cssErrors.push(`CSS Error: Invalid property value for ${prop} in rule ${rule.selectorText}`);
            }
          });
        }
      });
    } catch (e) {
      cssErrors.push(`CSS Error in stylesheet: ${e.message}`);
    }
  });
} catch (e) {
  cssErrors.push(`CSS Error loading stylesheets: ${e.message}`);
}

// Detectar errores de accesibilidad (falta de atributo alt en imágenes)
const images = document.querySelectorAll('img');
images.forEach(img => {
  if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
    img.setAttribute('alt', 'Image missing description');
    accessibilityErrors.push(`Fixed Accessibility: Added 'alt' attribute to image ${img.src}`);
  }
});

// Enviar errores al popup
const allErrors = [...errors, ...cssErrors, ...accessibilityErrors];
if (allErrors.length > 0) {
  chrome.runtime.sendMessage({ errors: allErrors });
}

