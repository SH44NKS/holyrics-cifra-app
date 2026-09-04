import { useMemo, useState } from 'react';
import '../styles/globals.css';

const NOTAS_SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTAS_BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function mod(n, m) {
  return ((n % m) + m) % m;
}

function transporAcorde(acorde, semitons) {
  if (!semitons) return acorde;

  return acorde.replace(/(^|\/)([A-G](?:#|b)?)/g, (match, prefixo, nota) => {
    let indice = NOTAS_SUSTENIDOS.indexOf(nota);
    const prefereBemol = nota.includes('b');

    if (indice === -1) indice = NOTAS_BEMOIS.indexOf(nota);
    if (indice === -1) return match;

    const novo = mod(indice + semitons, 12);
    return prefixo + (prefereBemol ? NOTAS_BEMOIS[novo] : NOTAS_SUSTENIDOS[novo]);
  });
}

function isLinhaDeCifra(linha) {
  const texto = linha.trim();
  if (!texto) return false;

  const tokens = texto.split(/\s+/);

  // Aceita acordes comuns: C, C#, Bb, Cm7, Cmaj7, C/E, Gsus4, etc.
  const acordeRegex = /^[A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add)?(?:\d+)?(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?(?:[+\-º°])?$/i;

  return tokens.length > 0 && tokens.every((token) => acordeRegex.test(token));
}

function isComentarioSecao(linha) {
  const texto = linha.trim();
  return texto.length >= 3 && texto.startsWith('[') && texto.endsWith(']');
}

function extrairAcordesComPosicao(linha) {
  const regex = /\S+/g;
  const acordes = [];
  let match;

  while ((match = regex.exec(linha)) !== null) {
    acordes.push({ text: match[0], index: match.index });
  }

  return acordes;
}

function mesclarAcordesELetra(linhaCifra, linhaLetra, tomOffset) {
  const acordes = extrairAcordesComPosicao(linhaCifra);
  let resultado = linhaLetra || '';

  for (let i = acordes.length - 1; i >= 0; i--) {
    const acorde = transporAcorde(acordes[i].text, tomOffset);

    while (resultado.length < acordes[i].index) resultado += ' ';

    resultado =
      resultado.slice(0, acordes[i].index) +
      `[${acorde}]` +
      resultado.slice(acordes[i].index);
  }

  return resultado.trimEnd();
}

function parsearMusica(texto, tomOffset) {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const tokens = [];
  let linhaDeCifras = null;

  const descarregarCifraPendente = () => {
    if (linhaDeCifras) {
      tokens.push({
        tipo: 'letra',
        texto: mesclarAcordesELetra(linhaDeCifras, '', tomOffset)
      });
      linhaDeCifras = null;
    }
  };

  for (const original of linhas) {
    const linha = original.trimEnd();
    const limpa = linha.trim();

    // Linhas vazias do site não determinam paginação.
    if (!limpa) continue;

    // [Refrão], [Ponte], [2x] => comentário exclusivo do retorno.
    if (isComentarioSecao(linha)) {
      descarregarCifraPendente();
      const comentario = limpa.slice(1, -1).trim();
      if (comentario) {
        tokens.push({ tipo: 'comentario', texto: `{c: ${comentario}}` });
      }
      continue;
    }

    if (isLinhaDeCifra(linha)) {
      descarregarCifraPendente();
      linhaDeCifras = linha;
      continue;
    }

    tokens.push({
      tipo: 'letra',
      texto: linhaDeCifras
        ? mesclarAcordesELetra(linhaDeCifras, linha, tomOffset)
        : linha
    });

    linhaDeCifras = null;
  }

  descarregarCifraPendente();
  return tokens;
}

function adicionarQuebra(resultado) {
  if (resultado.length && resultado[resultado.length - 1] !== '') {
    resultado.push('');
  }
}

function paginarTokens(tokens, linhasPorSlide) {
  const resultado = [];
  let visiveis = 0;

  for (const token of tokens) {
    if (token.tipo === 'comentario') {
      // Se o slide já está cheio, comentário pertence ao próximo bloco.
      if (visiveis >= linhasPorSlide) {
        adicionarQuebra(resultado);
        visiveis = 0;
      }
      resultado.push(token.texto);
      continue;
    }

    if (visiveis >= linhasPorSlide) {
      adicionarQuebra(resultado);
      visiveis = 0;
    }

    resultado.push(token.texto);
    visiveis++;
  }

  while (resultado.length && resultado[resultado.length - 1] === '') {
    resultado.pop();
  }

  return resultado;
}

function gerarChordPro({ titulo, artista, texto, linhasPorSlide, tomOffset }) {
  const resultado = [`{t: ${titulo || 'Música'}}`];

  if (artista) resultado.push(`{st: ${artista}}`);
  resultado.push('');

  const tokens = parsearMusica(texto, tomOffset);
  resultado.push(...paginarTokens(tokens, linhasPorSlide));

  return resultado.join('\n');
}

// ============================================================
// SIMULADOR V3
// Lê o ChordPro pronto e reproduz os blocos/slides.
// ============================================================

function extrairSlidesChordPro(chordPro) {
  const linhas = chordPro.replace(/\r/g, '').split('\n');
  const slides = [];
  let atual = [];

  for (const linha of linhas) {
    const limpa = linha.trim();

    // Metadados não aparecem no simulador.
    if (/^\{(?:t|st):/i.test(limpa)) continue;

    if (!limpa) {
      if (atual.length) {
        slides.push(atual);
        atual = [];
      }
      continue;
    }

    atual.push(linha);
  }

  if (atual.length) slides.push(atual);

  return slides;
}

function separarAcordesDaLetra(linha) {
  const acordes = [];
  const letra = linha.replace(/\[([^\]]+)\]/g, (_, acorde) => {
    acordes.push(acorde);
    return '';
  }).trim();

  return { acordes, letra };
}

function PreviewSimulador({ chordPro, titulo }) {
  const slides = useMemo(() => extrairSlidesChordPro(chordPro), [chordPro]);
  const [slideAtual, setSlideAtual] = useState(0);
  const [modoPalco, setModoPalco] = useState('completo');

  if (!slides.length) return null;

  const indiceSeguro = Math.min(slideAtual, slides.length - 1);
  const slide = slides[indiceSeguro];

  const anterior = () => setSlideAtual((v) => Math.max(0, v - 1));
  const proximo = () => setSlideAtual((v) => Math.min(slides.length - 1, v + 1));

  const irPara = (indice) => setSlideAtual(indice);

  return (
    <section className="simulator card">
      <div className="simulator-title">
        <div>
          <span className="section-label">NOVO NA V3</span>
          <h2>Simulador de Projeção e Retorno</h2>
          <p>
            Confira antes de baixar como cada bloco será organizado.
          </p>
        </div>

        <div className="slide-counter">
          Slide <strong>{indiceSeguro + 1}</strong> de <strong>{slides.length}</strong>
        </div>
      </div>

      <div className="screens">
        <div className="screen-wrapper">
          <div className="screen-label church-label">
            🖥️ TELA IGREJA
          </div>

          <div className="church-screen">
            <div className="church-song-title">{titulo}</div>

            <div className="church-content">
              {slide
                .filter((linha) => !/^\{c:/i.test(linha.trim()))
                .map((linha, index) => {
                  const { letra } = separarAcordesDaLetra(linha);
                  return (
                    <div className="church-line" key={`${linha}-${index}`}>
                      {letra || ' '}
                    </div>
                  );
                })}
            </div>

            <div className="church-footer">
              {indiceSeguro + 1} / {slides.length}
            </div>
          </div>
        </div>

        <div className="screen-wrapper">
          <div className="screen-label stage-label">
            🎹 RETORNO DE PALCO
          </div>

          <div className="stage-screen">
            <div className="stage-top">
              <span>{titulo}</span>
              <span>SLIDE {indiceSeguro + 1}/{slides.length}</span>
            </div>

            <div className={`stage-content ${modoPalco}`}>
              {slide.map((linha, index) => {
                const comentario = linha.match(/^\{c:\s*(.*?)\}$/i);

                if (comentario) {
                  return (
                    <div className="stage-comment" key={`${linha}-${index}`}>
                      ◆ {comentario[1]}
                    </div>
                  );
                }

                const partes = linha.split(/(\[[^\]]+\])/g);

                return (
                  <div className="stage-line" key={`${linha}-${index}`}>
                    {partes.map((parte, i) => {
                      if (/^\[[^\]]+\]$/.test(parte)) {
                        return (
                          <span className="chord" key={i}>
                            {parte.slice(1, -1)}
                          </span>
                        );
                      }

                      return <span key={i}>{parte}</span>;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="simulator-controls">
        <button onClick={anterior} disabled={indiceSeguro === 0}>
          ← Anterior
        </button>

        <div className="slide-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={i === indiceSeguro ? 'slide-dot active' : 'slide-dot'}
              onClick={() => irPara(i)}
              title={`Ir para slide ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button onClick={proximo} disabled={indiceSeguro === slides.length - 1}>
          Próximo →
        </button>
      </div>

      <div className="stage-options">
        <span>Visual do retorno:</span>
        <button
          className={modoPalco === 'completo' ? 'option active' : 'option'}
          onClick={() => setModoPalco('completo')}
        >
          Completo
        </button>
        <button
          className={modoPalco === 'compacto' ? 'option active' : 'option'}
          onClick={() => setModoPalco('compacto')}
        >
          Compacto
        </button>
      </div>

      <div className="analysis-box">
        <strong>📊 Análise deste slide:</strong>
        <span>
          {
            slide.filter(
              (linha) =>
                linha.trim() &&
                !/^\{c:/i.test(linha.trim())
            ).length
          } linha(s) visível(is)
        </span>
        <span>
          {
            slide.filter((linha) => /^\{c:/i.test(linha.trim())).length
          } comentário(s) de retorno
        </span>
      </div>
    </section>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [modoManual, setModoManual] = useState(false);
  const [textoManual, setTextoManual] = useState('');
  const [tituloMusica, setTituloMusica] = useState('');
  const [artistaMusica, setArtistaMusica] = useState('');
  const [linhasPorSlide, setLinhasPorSlide] = useState(3);
  const [tomOffset, setTomOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [previewText, setPreviewText] = useState('');

  const gerarPreview = async () => {
    setLoading(true);
    setErro('');

    try {
      let titulo = tituloMusica || 'Música';
      let artista = artistaMusica;
      let texto = textoManual;

      if (!modoManual) {
        if (!url.trim()) throw new Error('Informe o link da música.');

        const resposta = await fetch(`/api/cifra?url=${encodeURIComponent(url.trim())}`);
        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.error || 'Erro ao buscar cifra.');
        }

        titulo = dados.titulo;
        artista = dados.artista;
        texto = dados.text;

        setTituloMusica(titulo);
        setArtistaMusica(artista);
      }

      if (!texto.trim()) {
        throw new Error('Nenhuma cifra foi encontrada.');
      }

      const resultado = gerarChordPro({
        titulo,
        artista,
        texto,
        linhasPorSlide,
        tomOffset
      });

      setPreviewText(resultado);
    } catch (error) {
      setErro(error.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const baixarArquivo = () => {
    const blob = new Blob([previewText], {
      type: 'text/plain;charset=utf-8'
    });

    const arquivoUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const nomeSeguro = (tituloMusica || 'musica')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');

    link.href = arquivoUrl;
    link.download = `${nomeSeguro}_holyrics.cho`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(arquivoUrl);
  };

  return (
    <main className="container">
      <section className="hero">
        <span className="badge">VERSÃO 3 • LIVE PREVIEW</span>
        <h1>🎵 Cifra → Holyrics</h1>
        <p>
          Formate sua cifra, organize os slides e visualize a diferença entre
          a projeção da igreja e o retorno dos músicos antes de importar.
        </p>
      </section>

      <section className="card">
        <div className="tabs">
          <button
            className={!modoManual ? 'tab active' : 'tab'}
            onClick={() => setModoManual(false)}
          >
            🔗 Link do Cifra Club
          </button>

          <button
            className={modoManual ? 'tab active' : 'tab'}
            onClick={() => setModoManual(true)}
          >
            📋 Colar cifra
          </button>
        </div>

        {!modoManual ? (
          <div className="field">
            <label>Link da música</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.cifraclub.com.br/..."
            />
          </div>
        ) : (
          <>
            <div className="grid-2">
              <div className="field">
                <label>Título</label>
                <input
                  value={tituloMusica}
                  onChange={(e) => setTituloMusica(e.target.value)}
                  placeholder="Ex.: Grande é o Senhor"
                />
              </div>

              <div className="field">
                <label>Artista</label>
                <input
                  value={artistaMusica}
                  onChange={(e) => setArtistaMusica(e.target.value)}
                  placeholder="Ex.: Adoração"
                />
              </div>
            </div>

            <div className="field">
              <label>Letra e cifra original</label>
              <textarea
                className="source-textarea"
                value={textoManual}
                onChange={(e) => setTextoManual(e.target.value)}
                placeholder={'[Intro]\nG       D\nGrande é o Senhor\n\nEm quem nós temos a vitória\n[Todos]\nE que nos ajuda'}
              />
            </div>
          </>
        )}

        <div className="grid-2 controls">
          <div className="field">
            <label>Linhas por slide</label>
            <select
              value={linhasPorSlide}
              onChange={(e) => setLinhasPorSlide(Number(e.target.value))}
            >
              <option value={2}>2 linhas</option>
              <option value={3}>3 linhas • recomendado</option>
              <option value={4}>4 linhas</option>
            </select>
          </div>

          <div className="field">
            <label>Transpor tom</label>
            <input
              type="number"
              min="-11"
              max="11"
              value={tomOffset}
              onChange={(e) => setTomOffset(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="info">
          <div>🎯 <strong>Regra da V3:</strong></div>
          <p>
            Somente letras contam para formar os slides. Intro, refrão,
            instruções e comentários ficam disponíveis para os músicos sem
            alterar a quantidade de linhas mostradas à igreja.
          </p>
        </div>

        <button
          className="primary-button"
          disabled={loading || (!modoManual && !url.trim())}
          onClick={gerarPreview}
        >
          {loading ? 'Processando música...' : '✨ Gerar e Simular'}
        </button>

        {erro && <div className="error">⚠️ {erro}</div>}
      </section>

      {previewText && (
        <>
          <PreviewSimulador
            chordPro={previewText}
            titulo={tituloMusica || 'Música'}
          />

          <section className="card preview-card">
            <div className="preview-header">
              <div>
                <span className="section-label">ARQUIVO FINAL</span>
                <h2>ChordPro (.cho)</h2>
                <p>
                  Você pode editar o resultado manualmente antes de baixar.
                </p>
              </div>
            </div>

            <textarea
              className="preview-textarea"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              spellCheck="false"
            />

            <div className="preview-actions">
              <button className="download-button" onClick={baixarArquivo}>
                ⬇ Baixar .CHO pronto para Holyrics
              </button>
            </div>
          </section>
        </>
      )}

      <section className="card rules">
        <span className="section-label">COMO A PAGINAÇÃO FUNCIONA</span>
        <h2>📐 Regras inteligentes</h2>

        <div className="rules-grid">
          <div>
            <strong>1. Letra</strong>
            <span>Conta como linha visível na projeção.</span>
          </div>
          <div>
            <strong>2. Comentário</strong>
            <span>Não conta e permanece disponível no retorno.</span>
          </div>
          <div>
            <strong>3. Linha vazia</strong>
            <span>Não interfere na paginação automática.</span>
          </div>
          <div>
            <strong>4. Limite</strong>
            <span>2, 3 ou 4 letras definem o próximo slide.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
