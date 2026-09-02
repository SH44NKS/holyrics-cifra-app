import { useState } from 'react';

// Constantes para transposição
const NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTAS_B = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transporAcorde(acorde, semitons) {
  if (semitons === 0) return acorde;
  return acorde.replace(/[A-G][#b]?/g, (match) => {
    let isFlat = match.includes('b');
    let index = NOTAS.indexOf(match);
    if (index === -1) index = NOTAS_B.indexOf(match);
    if (index === -1) return match;

    let novoIndex = (index + semitons) % 12;
    if (novoIndex < 0) novoIndex += 12;

    return isFlat ? NOTAS_B[novoIndex] : NOTAS[novoIndex];
  });
}

function isLinhaDeCifra(linha) {
  if (!linha.trim()) return false;
  const validChars = /^[\sA-G#bmM0-9\/\(\)\+º°]+$/;
  return validChars.test(linha);
}

function mesclarAcordesELetra(linhaCifra, linhaLetra, offsetTom) {
  const regex = /[^\s]+/g;
  let match;
  const acordes = [];
  
  while ((match = regex.exec(linhaCifra)) !== null) {
    acordes.push({ text: match[0], index: match.index });
  }

  let resultado = linhaLetra || "";
  
  for (let i = acordes.length - 1; i >= 0; i--) {
    let { text, index } = acordes[i];
    text = transporAcorde(text, offsetTom);

    while (resultado.length < index) {
      resultado += " ";
    }
    
    resultado = resultado.substring(0, index) + `[${text}]` + resultado.substring(index);
  }
  return resultado.trimEnd();
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [linhasPorSlide, setLinhasPorSlide] = useState(2);
  const [tomOffset, setTomOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  
  // Novos estados para o Preview
  const [previewText, setPreviewText] = useState('');
  const [tituloMusica, setTituloMusica] = useState('Musica');

  const gerarPreview = async () => {
    setLoading(true);
    setErro('');
    setPreviewText(''); // Limpa o preview anterior
    
    try {
      const res = await fetch(`/api/cifra?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      setTituloMusica(data.titulo); // Salva para usar no nome do arquivo depois

      const linhas = data.text.split('\n');
      let resultado = [];
      
      resultado.push(`{t: ${data.titulo}}`);
      resultado.push(`{st: ${data.artista}}`);
      resultado.push('');

      let linhaDeCifras = null;
      let contadorLetra = 0;

      for (let i = 0; i < linhas.length; i++) {
        let linha = linhas[i].trimEnd();

        if (linha.trim() === '') {
          if (linhaDeCifras) {
            resultado.push(mesclarAcordesELetra(linhaDeCifras, "", tomOffset));
            linhaDeCifras = null;
          }
          if (resultado[resultado.length - 1] !== '') resultado.push('');
          contadorLetra = 0;
          continue;
        }

        if (linha.trim().startsWith('[') && linha.trim().endsWith(']')) {
          if (linhaDeCifras) {
            resultado.push(mesclarAcordesELetra(linhaDeCifras, "", tomOffset));
            linhaDeCifras = null;
          }
          let comentario = linha.trim().replace('[', '').replace(']', '');
          resultado.push(`{c: ${comentario}}`);
          contadorLetra = 0;
          continue;
        }

        if (isLinhaDeCifra(linha)) {
          if (linhaDeCifras) {
             resultado.push(mesclarAcordesELetra(linhaDeCifras, "", tomOffset));
          }
          linhaDeCifras = linha;
        } else {
          let linhaFinal = linha;
          if (linhaDeCifras) {
            linhaFinal = mesclarAcordesELetra(linhaDeCifras, linha, tomOffset);
            linhaDeCifras = null;
          }

          resultado.push(linhaFinal);
          contadorLetra++;

          if (contadorLetra >= linhasPorSlide) {
            resultado.push(''); 
            contadorLetra = 0;
          }
        }
      }

      const textoFinal = resultado.join('\n');
      setPreviewText(textoFinal); // Joga o resultado na caixa de texto em vez de baixar

    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  const baixarArquivo = () => {
    // Pega o texto diretamente da caixa de edição
    const blob = new Blob([previewText], { type: 'text/plain' });
    const urlDownload = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlDownload;
    
    // Limpa o nome do arquivo para não ter caracteres inválidos
    const nomeSeguro = tituloMusica.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${nomeSeguro}_holyrics.cho`;
    
    a.click();
    URL.revokeObjectURL(urlDownload);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', fontFamily: 'sans-serif', padding: '20px' }}>
      <h2>Sistema Cifra → Holyrics (ChordPro)</h2>
      
      <div style={{ marginBottom: '15px' }}>
        <label>Link do Cifra Club:</label><br/>
        <input 
          type="text" 
          value={url} 
          onChange={(e) => setUrl(e.target.value)} 
          placeholder="https://www.cifraclub.com.br/..."
          style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div>
          <label>Letras por Slide:</label><br/>
          <select value={linhasPorSlide} onChange={(e) => setLinhasPorSlide(Number(e.target.value))} style={{ padding: '8px', marginTop: '5px', borderRadius: '5px' }}>
            <option value={2}>2 Linhas</option>
            <option value={3}>3 Linhas</option>
            <option value={4}>4 Linhas</option>
          </select>
        </div>

        <div>
          <label>Mudar Tom (Ex: 1 ou -1):</label><br/>
          <input 
            type="number" 
            value={tomOffset} 
            onChange={(e) => setTomOffset(Number(e.target.value))}
            style={{ width: '120px', padding: '8px', marginTop: '5px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
        </div>
      </div>

      <button 
        onClick={gerarPreview} 
        disabled={loading || !url}
        style={{ padding: '12px 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        {loading ? 'Buscando e Formatando...' : 'Gerar Preview'}
      </button>

      {erro && <p style={{ color: 'red', marginTop: '15px' }}>{erro}</p>}

      {/* ÁREA DE PREVIEW EDITÁVEL */}
      {previewText && (
        <div style={{ marginTop: '30px', borderTop: '2px solid #eee', paddingTop: '20px' }}>
          <h3>Preview e Edição</h3>
          <p style={{ fontSize: '14px', color: '#666' }}>
            Revise a cifra abaixo. Você pode apagar quebras de linha indesejadas, corrigir acordes fora do lugar (no formato <code>[Acorde]</code>) ou ajustar os comentários em <code>{`{c: Comentário}`}</code>.
          </p>
          
          <textarea 
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            style={{
              width: '100%',
              height: '400px',
              fontFamily: 'monospace',
              fontSize: '14px',
              padding: '15px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              whiteSpace: 'pre',
              overflowWrap: 'normal',
              overflowX: 'scroll',
              lineHeight: '1.5'
            }}
          />

          <button 
            onClick={baixarArquivo} 
            style={{ padding: '15px 30px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginTop: '15px', width: '100%', fontSize: '16px' }}
          >
            Baixar Arquivo .cho Pronto para Holyrics
          </button>
        </div>
      )}
    </div>
  );
}