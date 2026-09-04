import axios from 'axios';
import * as cheerio from 'cheerio';

function urlValida(valor) {
  try {
    const parsed = new URL(valor);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || typeof url !== 'string' || !urlValida(url)) {
    return res.status(400).json({
      error: 'Envie uma URL válida.'
    });
  }

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });

    const $ = cheerio.load(response.data);

    const titulo =
      $('h1.t1').first().text().trim() ||
      $('h1').first().text().trim() ||
      'Música';

    const artista =
      $('h2.t3 a').first().text().trim() ||
      $('.t3 a').first().text().trim() ||
      '';

    let cifraTexto = '';

    $('pre').each((_, elemento) => {
      const texto = $(elemento).text();
      if (texto.trim().length > cifraTexto.trim().length) {
        cifraTexto = texto;
      }
    });

    if (!cifraTexto.trim()) {
      return res.status(404).json({
        error: 'Cifra não encontrada. Tente o modo manual.'
      });
    }

    return res.status(200).json({
      titulo,
      artista,
      text: cifraTexto.replace(/\r/g, '')
    });
  } catch (error) {
    const status = error.response?.status;

    if (status === 403 || status === 429) {
      return res.status(502).json({
        error: 'O site bloqueou a consulta automática. Use o modo manual.'
      });
    }

    return res.status(500).json({
      error: 'Não foi possível buscar esta cifra.'
    });
  }
}
