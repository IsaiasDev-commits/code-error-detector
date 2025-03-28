chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.errors) {
    const errorList = document.getElementById('error-list');
    errorList.innerHTML = ''; // Limpiar la lista de errores antes de agregar los nuevos
    request.errors.forEach(error => {
      const li = document.createElement('li');
      li.className = 'error'; // Añadir clase de error para el estilo
      li.textContent = error;
      errorList.appendChild(li);
    });
  }
});

// Funcionalidad para borrar los errores
document.getElementById('clear-errors').addEventListener('click', function() {
  const errorList = document.getElementById('error-list');
  errorList.innerHTML = ''; // Limpiar la lista de errores

  // Puedes enviar un mensaje a content.js o background.js si quieres hacer algo adicional al limpiar los errores
  chrome.runtime.sendMessage({ action: 'clearErrors' });
});
