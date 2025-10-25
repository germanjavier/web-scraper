#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Extrae datos estructurados de una página web
 * @param {string} url - URL de la página a analizar
 * @returns {Promise<Object>} - Objeto con la información extraída
 */
async function scrapeWebsite(url) {
    try {
        // Validar formato de URL
        if (!isValidUrl(url)) {
            throw new Error('Formato de URL inválido. Incluye http:// o https://');
        }

        // Obtener el contenido HTML
        console.error(`Analizando: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WebScraper/1.0)'
            },
            timeout: 10000 // 10 segundos de timeout
        });

        const $ = cheerio.load(response.data);
        const baseUrl = new URL(url);

        // Extraer información básica
        const pageInfo = {
            url: url,
            titulo: $('title').text().trim(),
            descripcion: $('meta[name="description"]').attr('content') || 'No encontrada',
            idioma: $('html').attr('lang') || 'No especificado',
            palabrasClave: $('meta[name="keywords"]').attr('content') || 'No especificadas',
            fechaAnalisis: new Date().toISOString()
        };

        // Extraer encabezados
        const encabezados = {
            h1: [],
            h2: [],
            h3: [],
            h4: [],
            h5: [],
            h6: []
        };

        // Llenar encabezados
        for (let i = 1; i <= 6; i++) {
            $(`h${i}`).each((_, el) => {
                const texto = $(el).text().trim();
                if (texto) encabezados[`h${i}`].push(texto);
            });
        }

        // Extraer párrafos
        const parrafos = [];
        $('p').each((_, el) => {
            const texto = $(el).text().trim();
            if (texto) parrafos.push(texto);
        });

        // Extraer enlaces con texto
        const enlaces = [];
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            const texto = $(el).text().trim();
            
            // Convertir a URL absoluta
            let urlAbsoluta;
            try {
                urlAbsoluta = new URL(href, url).toString();
            } catch (e) {
                return; // Saltar enlaces inválidos
            }

            if (urlAbsoluta) {
                enlaces.push({
                    url: urlAbsoluta,
                    texto: texto || '[Sin texto]',
                    esExterna: !urlAbsoluta.startsWith(baseUrl.origin)
                });
            }
        });

        // Extraer imágenes con atributos relevantes
        const imagenes = [];
        $('img').each((_, el) => {
            const src = $(el).attr('src');
            if (!src) return;

            try {
                const urlImagen = new URL(src, url).toString();
                imagenes.push({
                    src: urlImagen,
                    alt: $(el).attr('alt') || 'Sin descripción',
                    titulo: $(el).attr('title') || 'Sin título',
                    ancho: $(el).attr('width') || 'No especificado',
                    alto: $(el).attr('height') || 'No especificado'
                });
            } catch (e) {
                // Ignorar URLs de imagen inválidas
            }
        });

        // Extraer metadatos de redes sociales (Open Graph, Twitter Cards)
        const metadatos = {
            openGraph: {},
            twitter: {}
        };

        $('meta[property^="og:"]').each((_, el) => {
            const propiedad = $(el).attr('property').replace('og:', '');
            metadatos.openGraph[propiedad] = $(el).attr('content');
        });

        $('meta[name^="twitter:"]').each((_, el) => {
            const propiedad = $(el).attr('name').replace('twitter:', '');
            metadatos.twitter[propiedad] = $(el).attr('content');
        });

        // Estadísticas
        const estadisticas = {
            totalEnlaces: enlaces.length,
            enlacesExternos: enlaces.filter(link => link.esExterna).length,
            totalImagenes: imagenes.length,
            totalParrafos: parrafos.length,
            totalPalabras: parrafos.join(' ').split(/\s+/).filter(Boolean).length
        };

        return {
            informacionBasica: pageInfo,
            estructura: {
                encabezados,
                parrafos,
                totalSecciones: Object.values(encabezados).reduce((a, b) => a + b.length, 0)
            },
            enlaces: {
                lista: enlaces,
                resumen: {
                    total: estadisticas.totalEnlaces,
                    externos: estadisticas.enlacesExternos,
                    internos: estadisticas.totalEnlaces - estadisticas.enlacesExternos
                }
            },
            imagenes: {
                lista: imagenes,
                total: estadisticas.totalImagenes
            },
            metadatos,
            estadisticas: {
                totalParrafos: estadisticas.totalParrafos,
                totalPalabras: estadisticas.totalPalabras,
                palabrasPorParrafo: estadisticas.totalParrafos > 0 
                    ? (estadisticas.totalPalabras / estadisticas.totalParrafos).toFixed(2)
                    : 0
            },
            estado: 'éxito'
        };
    } catch (error) {
        // Manejar diferentes tipos de errores
        if (error.response) {
            throw new Error(`Error ${error.response.status}: ${error.response.statusText}`);
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Tiempo de espera agotado. El servidor no respondió a tiempo.');
        } else if (error.request) {
            throw new Error('No se recibió respuesta del servidor. Verifica tu conexión a internet.');
        } else {
            throw new Error(`Error: ${error.message}`);
        }
    }
}

/**
 * Validates URL format
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if URL is valid
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

// Ejecución principal cuando se llama desde la línea de comandos
if (require.main === module) {
    // Obtener URL de los argumentos de línea de comandos
    const url = process.argv[2];
    
    if (!url) {
        console.error('Uso: node scraper.js <URL>');
        console.error('Ejemplo: node scraper.js https://ejemplo.com');
        process.exit(1);
    }

    // Analizar el sitio web y mostrar los resultados
    console.error('🚀 Iniciando análisis...\n');
    
    const inicio = Date.now();
    scrapeWebsite(url)
        .then(data => {
            const duracion = ((Date.now() - inicio) / 1000).toFixed(2);
            console.log(JSON.stringify({
                ...data,
                estadisticas: {
                    ...data.estadisticas,
                    tiempoDeCarga: `${duracion} segundos`
                }
            }, null, 2));
        })
        .catch(error => {
            console.error(JSON.stringify({
                estado: 'error',
                mensaje: error.message,
                fecha: new Date().toISOString()
            }, null, 2));
            process.exit(1);
        });
}

// Export for testing or programmatic use
module.exports = { scrapeWebsite };
