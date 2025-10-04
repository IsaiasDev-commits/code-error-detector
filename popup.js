class PopupManager {
  constructor() {
    this.errors = [];
    this.currentTab = null;
    this.init();
  }

  async init() {
    await this.getCurrentTab();
    this.loadErrors();
    this.setupEventListeners();
    this.setupMessageListener();
  }

  async getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tabs[0];
    console.log('Current tab:', this.currentTab);
  }

  loadErrors() {
    if (!this.currentTab) return;

    // Solicitar errores al background script
    chrome.runtime.sendMessage({ action: 'getErrors' }, (response) => {
      if (response && response.errors) {
        this.errors = response.errors;
        this.updateUI();
      } else {
        console.log('No errors found in background');
        this.errors = [];
        this.updateUI();
      }
    });
  }

  setupEventListeners() {
    document.getElementById('clear-errors').addEventListener('click', () => {
      this.clearErrors();
    });

    document.getElementById('analyze-code').addEventListener('click', () => {
      this.analyzeWithAI();
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Popup received message:', request);
      
      if (request.errors) {
        this.errors = request.errors;
        this.updateUI();
        sendResponse({ success: true });
      }
      return true;
    });
  }

  updateUI() {
    const errorList = document.getElementById('error-list');
    const emptyState = document.getElementById('empty-state');
    const errorCount = document.getElementById('error-count');
    const loading = document.getElementById('loading');

    // Ocultar loading si está visible
    loading.style.display = 'none';

    // Actualizar contador
    errorCount.textContent = `${this.errors.length} errores detectados`;

    if (this.errors.length === 0) {
      emptyState.style.display = 'block';
      errorList.innerHTML = '';
      errorList.appendChild(emptyState);
    } else {
      emptyState.style.display = 'none';
      
      const frag = document.createDocumentFragment();
      this.errors.forEach((error, index) => {
        const errorElement = this.createErrorElement(error, index);
        frag.appendChild(errorElement);
      });

      errorList.innerHTML = '';
      errorList.appendChild(frag);
      
      // Scroll to top
      errorList.scrollTop = 0;
    }
  }

  createErrorElement(error, index) {
    const div = document.createElement('div');
    div.className = 'error';
    
    // Determinar tipo y severidad
    let type = 'General';
    let severity = 'medium';
    
    if (error.includes('JavaScript') || error.includes('Syntax')) {
      type = 'JavaScript';
      severity = 'high';
    } else if (error.includes('CSS')) {
      type = 'CSS';
      severity = 'medium';
    } else if (error.includes('Accessibility')) {
      type = 'Accesibilidad';
      severity = 'medium';
    } else if (error.includes('Security') || error.includes('XSS')) {
      type = 'Seguridad';
      severity = 'high';
    } else if (error.includes('Runtime')) {
      type = 'Runtime';
      severity = 'high';
    }

    // Añadir clase de severidad
    div.classList.add(`error-severity-${severity}`);

    div.innerHTML = `
      <div class="error-type">${type.toUpperCase()} • ${severity.toUpperCase()}</div>
      <div class="error-message">${this.escapeHtml(error)}</div>
    `;

    // Añadir tooltip para errores largos
    if (error.length > 100) {
      div.title = error;
    }

    return div;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clearErrors() {
    this.errors = [];
    this.updateUI();
    
    // Limpiar en background
    chrome.runtime.sendMessage({ action: 'clearErrors' }, (response) => {
      if (response && response.success) {
        console.log('Errors cleared in background');
      }
    });

    // Limpiar en content script
    if (this.currentTab) {
      chrome.tabs.sendMessage(this.currentTab.id, { action: 'clearErrors' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Content script not available:', chrome.runtime.lastError);
        } else {
          console.log('Errors cleared in content script');
        }
      });
    }
  }

  async analyzeWithAI() {
    if (!this.currentTab) {
      alert('No se pudo acceder a la pestaña actual');
      return;
    }

    const loading = document.getElementById('loading');
    const analyzeBtn = document.getElementById('analyze-code');
    
    // Mostrar loading
    loading.style.display = 'block';
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span>⏳</span> Analizando...';

    try {
      // Ejecutar script en la pestaña actual para obtener código
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        function: getPageCodeForAnalysis
      });

      if (results && results[0] && results[0].result) {
        const pageCode = results[0].result;
        console.log('Page code for analysis:', pageCode.substring(0, 200) + '...');

        // Enviar a Groq para análisis
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'analyzeWithAI', code: pageCode },
            resolve
          );
        });

        if (response && response.success) {
          this.handleAIResponse(response.result);
        } else {
          throw new Error(response?.error || 'Error desconocido del servidor');
        }
      } else {
        throw new Error('No se pudo obtener el código de la página');
      }
    } catch (error) {
      console.error('Error in AI analysis:', error);
      alert('Error al analizar con IA: ' + error.message);
    } finally {
      // Ocultar loading y restaurar botón
      loading.style.display = 'none';
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '<span>🤖</span> Analizar con IA';
    }
  }

  handleAIResponse(aiResult) {
    try {
      console.log('AI Response raw:', aiResult);
      
      // Intentar parsear como JSON
      let analysis;
      try {
        analysis = JSON.parse(aiResult);
      } catch (e) {
        // Si no es JSON válido, mostrar como texto
        analysis = { raw: aiResult };
      }

      this.showAIAnalysis(analysis);
    } catch (e) {
      console.error('Error processing AI response:', e);
      this.showAIAnalysis({ raw: aiResult, error: e.message });
    }
  }

  showAIAnalysis(analysis) {
    // Crear ventana de análisis
    const analysisWindow = window.open('', '_blank', 'width=700,height=600,scrollbars=yes');
    
    if (!analysisWindow) {
      alert('Por favor permite ventanas emergentes para ver el análisis completo');
      return;
    }

    analysisWindow.document.write(`
      <html>
        <head>
          <title>🤖 Análisis de IA - Code Assistant Pro</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 25px; 
              background: #f5f5f5;
              color: #333;
              line-height: 1.6;
            }
            .container {
              max-width: 650px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            h1 {
              color: #667eea;
              text-align: center;
              margin-bottom: 10px;
              border-bottom: 2px solid #667eea;
              padding-bottom: 10px;
            }
            .section {
              margin-bottom: 25px;
              padding: 20px;
              border-radius: 8px;
            }
            .section h3 {
              margin-top: 0;
              color: #2c3e50;
              border-bottom: 1px solid #ecf0f1;
              padding-bottom: 8px;
            }
            .error-item {
              background: #fff3cd;
              padding: 12px;
              margin: 8px 0;
              border-radius: 6px;
              border-left: 4px solid #ffc107;
            }
            .solution {
              background: #d1ecf1;
              padding: 12px;
              margin: 8px 0;
              border-radius: 6px;
              border-left: 4px solid #17a2b8;
            }
            .tip {
              background: #d4edda;
              padding: 12px;
              margin: 8px 0;
              border-radius: 6px;
              border-left: 4px solid #28a745;
            }
            .severity-high { border-left-color: #dc3545 !important; background: #f8d7da !important; }
            .severity-medium { border-left-color: #ffc107 !important; background: #fff3cd !important; }
            .severity-low { border-left-color: #28a745 !important; background: #d4edda !important; }
            .raw-response {
              background: #2c3e50;
              color: #ecf0f1;
              padding: 15px;
              border-radius: 6px;
              font-family: 'Courier New', monospace;
              white-space: pre-wrap;
              font-size: 12px;
            }
            .timestamp {
              text-align: center;
              color: #7f8c8d;
              font-size: 12px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔍 Análisis de IA - Code Assistant Pro</h1>
            <div class="timestamp">Generado: ${new Date().toLocaleString()}</div>
            
            ${analysis.raw ? 
              `<div class="section">
                <h3>📝 Respuesta en Bruto</h3>
                <div class="raw-response">${this.escapeHtml(analysis.raw)}</div>
              </div>` 
              : 
              `
              ${analysis.errores && analysis.errores.length ? `
                <div class="section">
                  <h3>🚨 Errores Encontrados (${analysis.errores.length})</h3>
                  ${analysis.errores.map((err, i) => {
                    const severity = analysis.severidad && analysis.severidad[i] ? analysis.severidad[i] : 'medium';
                    return `<div class="error-item severity-${severity}">
                      <strong>${this.escapeHtml(err)}</strong>
                      ${analysis.explicaciones && analysis.explicaciones[i] ? 
                        `<div style="margin-top: 5px; font-size: 14px;">${this.escapeHtml(analysis.explicaciones[i])}</div>` : ''}
                    </div>`;
                  }).join('')}
                </div>
              ` : '<div class="section"><h3>✅ No se encontraron errores críticos</h3></div>'}
              
              ${analysis.soluciones && analysis.soluciones.length ? `
                <div class="section">
                  <h3>💡 Soluciones Propuestas</h3>
                  ${analysis.soluciones.map(sol => 
                    `<div class="solution">${this.escapeHtml(sol)}</div>`
                  ).join('')}
                </div>
              ` : ''}
              
              ${analysis.consejos && analysis.consejos.length ? `
                <div class="section">
                  <h3>🎯 Consejos y Buenas Prácticas</h3>
                  ${analysis.consejos.map(tip => 
                    `<div class="tip">${this.escapeHtml(tip)}</div>`
                  ).join('')}
                </div>
              ` : ''}
              `
            }
            
            ${analysis.error ? `
              <div class="section">
                <h3>❌ Error de Procesamiento</h3>
                <div class="error-item">${this.escapeHtml(analysis.error)}</div>
              </div>
            ` : ''}
          </div>
        </body>
      </html>
    `);
    
    analysisWindow.document.close();
  }
}

// Inicializar el popup cuando se carga
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando Popup Manager...');
  window.popupManager = new PopupManager();
});