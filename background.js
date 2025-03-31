chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'clearErrors') {
    console.log('Errors cleared!');
  } else if (request.action === 'checkAndFixCode') {
    const selectedCode = request.code;
    const errors = analyzeCode(selectedCode); // Lógica para analizar el código

    if (errors.length > 0) {
      sendResponse({ errors: errors });

      const fixedCode = fixCode(selectedCode); // Función para corregir el código
      applyFixedCode(fixedCode);
    }
  }
});

// Función para analizar el código
function analyzeCode(code) {
  const errors = [];
  try {
    eval(code);  // Simplemente intenta evaluar el código
  } catch (e) {
    if (e instanceof SyntaxError) {
      errors.push(`Syntax Error: ${e.message}`);
    }
  }
  return errors;
}

// Función para corregir el código
function fixCode(code) {
  let fixedCode = code;
  if (code.includes("let x = ;")) {
    fixedCode = code.replace("let x = ;", "let x = 0;");
  }
  return fixedCode;
}

// Aplicar el código corregido
function applyFixedCode(fixedCode) {
  const scriptElement = document.createElement('script');
  scriptElement.textContent = fixedCode;
  document.head.appendChild(scriptElement); // Inserta el código corregido en la página
}

