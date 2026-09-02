import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Envie a URL do Cifra Club' });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Captura os dados da música
    const titulo = $('h1.t1').text().trim() || 'Música Desconhecida';
    const artista = $('h2.t3 a').text().trim() || 'Artista Desconhecido';
    const cifraTexto = $('pre').text(); 
    
    if (!cifraTexto) {
      return res.status(404).json({ error: 'Cifra não encontrada.' });
    }

    res.status(200).json({ titulo, artista, text: cifraTexto });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar a cifra.' });
  }
}