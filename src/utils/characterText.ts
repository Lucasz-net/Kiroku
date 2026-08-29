// Limpieza de las biografías de personaje que devuelven Jikan (`about`) y la
// API oficial de MAL (`biography`). Ambas vienen como texto plano "sucio":
// etiquetas <br />, entidades HTML sin decodificar (&#039;, &quot;), enlaces
// crudos pegados al final y bloques de fichas técnicas repetidos.
//
// Existe como util compartido porque las dos fuentes necesitan exactamente el
// mismo tratamiento antes de renderizarse, y porque el panel de personaje
// muestra ese texto tal cual: cualquier resto de markup se ve como basura.

const ENTITIES: Record<string, string> = {
  '&quot;': '"',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
};

const decodeEntities = (text: string): string =>
  text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, entity => ENTITIES[entity.toLowerCase()] ?? entity);

export function cleanCharacterBio(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const text = decodeEntities(
    raw
      .replace(/\r\n?/g, '\n')
      // MAL escribe cada salto como "<br />\r\n", donde la etiqueta y el
      // newline son el mismo salto: el <br> absorbe el newline que le sigue
      // para no dejar un renglón vacío entre línea y línea.
      .replace(/<br\s*\/?>[ \t]*\n?/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    // BBCode que MAL guarda crudo en las biografías: además de [spoiler],
    // aparecen [b], [i], [url=...] y compañía. Se listan las etiquetas
    // conocidas en vez de borrar todo lo que esté entre corchetes, para no
    // comerse texto legítimo como "[Nota del traductor]".
    //
    // Va ANTES de limpiar enlaces: en "[url=http://x.com]texto[/url]" la URL
    // no termina en espacio, así que el barrido de enlaces se llevaría
    // también el cierre de la etiqueta y dejaría un "[url=" suelto.
    .replace(/\[\/?(?:b|i|u|s|spoiler|url|img|quote|code|center|size|color|list)(?:=[^\]]*)?\]/gi, '')
    // Enlaces crudos ("https://anilist.co/character/...", fuentes de wikis).
    // Nunca son útiles dentro del panel y rompen el flujo del texto.
    .replace(/https?:\/\/\S+/g, '')
    // Créditos de fuente al final del texto, que MAL/Jikan arrastran del wiki.
    .replace(/\(\s*(source|fuente)\s*:[^)]*\)/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text.length > 0 ? text : null;
}
