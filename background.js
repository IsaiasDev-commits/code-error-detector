const GROQ_API_KEY = loadApiKey();
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Función segura para cargar la API key
function loadApiKey() {
    // 1. Intentar desde config.js (local)
    try {
        if (typeof CONFIG !== 'undefined' && CONFIG.GROQ_API_KEY) {
            console.log('✅ API key cargada desde config.js');
            return CONFIG.GROQ_API_KEY;
        }
    } catch (e) {
        console.log('❌ config.js no disponible');
    }
    
    // 2. Intentar desde localStorage (para desarrollo)
    try {
        const storedKey = localStorage.getItem('groq_api_key');
        if (storedKey) {
            console.log('✅ API key cargada desde localStorage');
            return storedKey;
        }
    } catch (e) {
        console.log('❌ localStorage no disponible');
    }
    
    // 3. Clave vacía (se pedirá al usuario)
    console.log('⚠️ API key no configurada');
    return "";
}

// Almacenamiento de errores
let detectedErrors = [];

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request);
  
  if (request.action === 'clearErrors') {
    detectedErrors = [];
    console.log('Errors cleared!');
    sendResponse({ success: true });
  } 
  else if (request.action === 'analyzeWithAI') {
    // Verificar si hay API key
    if (!GROQ_API_KEY) {
      sendResponse({ 
        success: false, 
        error: 'API key no configurada. Configura tu clave de Groq en config.js' 
      });
      return;
    }
    
    console.log('Analyzing with AI:', request.code.substring(0, 100) + '...');
    
    analyzeCodeWithAI(request.code).then(result => {
      console.log('AI Analysis result:', result);
      sendResponse({ success: true, result: result });
    }).catch(error => {
      console.error('AI Analysis error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  else if (request.errors) {
    console.log('Storing errors:', request.errors);
    detectedErrors = request.errors;
    sendResponse({ success: true });
  }
  else if (request.action === 'getErrors') {
    sendResponse({ errors: detectedErrors });
  }
  else if (request.action === 'setApiKey') {
    // Para configurar API key desde la extensión
    try {
      localStorage.setItem('groq_api_key', request.apiKey);
      console.log('✅ API key guardada en localStorage');
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
});

// Función principal para analizar código con Groq
async function analyzeCodeWithAI(code) {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: `Eres CodeMaster AI, un experto senior en JavaScript, TypeScript, CSS, HTML y desarrollo web moderno.

ANÁLISIS QUE DEBES HACER:
1. ✅ SINTÁXIS - Errores de escritura, paréntesis, llaves, puntos y coma
2. ✅ LÓGICA - Problemas de razonamiento, condiciones incorrectas
3. ✅ PERFORMANCE - Código ineficiente, memory leaks
4. ✅ SEGURIDAD - XSS, eval peligrosos, inyecciones
5. ✅ ACCESIBILIDAD - HTML semántico, ARIA labels
6. ✅ BUENAS PRÁCTICAS - Clean code, patrones modernos

RESPONDE EXCLUSIVAMENTE en este formato JSON:

{
  "errores": [],
  "explicaciones": [], 
  "soluciones": [],
  "consejos": [],
  "severidad": []
}

Ejemplo real:
{
  "errores": ["Uso de innerHTML sin sanitizar", "Variable no declarada 'usuario'"],
  "explicaciones": ["innerHTML puede causar XSS attacks", "La variable 'usuario' no está declarada con var/let/const"],
  "soluciones": ["Usar textContent o sanitizar input", "Agregar 'let usuario = null;' antes del uso"],
  "consejos": ["Nunca confíes en user input", "Siempre declarar variables explicitamente"],
  "severidad": ["alta", "media"]
}

Sé técnico pero claro. Enfócate en errores REALES que afecten funcionalidad.`
          },
          {
            role: "user",
            content: `Analiza este código y encuentra errores REALES. Sé exhaustivo pero conciso:\n\n${code.substring(0, 3000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        timeout: 30000
      })
    });

    if (!response.ok) {
      console.log(`API response not OK: ${response.status}`);
      const errorText = await response.text();
      console.log('Error response:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Groq API response received');
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('Error with Groq API:', error);
    // Intentar con modelos alternativos
    return await tryAlternativeModels(code);
  }
}

// Función para probar modelos alternativos si el principal falla
async function tryAlternativeModels(code) {
  const alternativeModels = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant"
  ];

  for (const model of alternativeModels) {
    try {
      console.log(`Probando modelo alternativo: ${model}`);
      
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: `Analiza código y responde en JSON con: {errores, explicaciones, soluciones, consejos, severidad}. Sé conciso.`
            },
            {
              role: "user",
              content: `Analiza este código:\n\n${code.substring(0, 2000)}`
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Modelo ${model} funcionó`);
        return data.choices[0].message.content;
      } else {
        console.log(`Modelo ${model} failed: ${response.status}`);
      }
    } catch (error) {
      console.warn(`Modelo ${model} falló:`, error);
      continue;
    }
  }
  
  throw new Error('Todos los modelos de Groq fallaron. Verifica tu API key.');
}

// Función para obtener errores almacenados
function getStoredErrors() {
  return detectedErrors;
}

// Inicialización - Verificar configuración al cargar
console.log('🚀 Code Assistant Pro iniciado');
console.log('API Key configurada:', GROQ_API_KEY ? '✅ Sí' : '❌ No');

// Exportar para testing (opcional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { analyzeCodeWithAI, tryAlternativeModels, loadApiKey };
}