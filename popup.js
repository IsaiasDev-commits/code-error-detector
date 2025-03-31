// Recibir errores de content.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.errors) {
    const errorList = document.getElementById('error-list');
    errorList.innerHTML = ''; // Limpiar la lista de errores antes de agregar los nuevos

    const frag = document.createDocumentFragment();
    request.errors.forEach(error => {
      const li = document.createElement('li');
      li.className = 'error'; // Añadir clase de error para el estilo
      li.textContent = error; // Usar textContent para evitar problemas de seguridad
      frag.appendChild(li);
    });

    errorList.appendChild(frag);
  }
});

// Funcionalidad para borrar los errores
document.getElementById('clear-errors').addEventListener('click', function() {
  const errorList = document.getElementById('error-list');
  errorList.innerHTML = ''; // Limpiar la lista de errores

  // Enviar mensaje a content.js o background.js para realizar una acción adicional si es necesario
  chrome.runtime.sendMessage({ action: 'clearErrors' });
});

