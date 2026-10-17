// Word count used for quotes and automatic document analysis (letters and numbers, any script).
export function sourceWordCount(text:string){return [...new Intl.Segmenter(undefined,{granularity:'word'}).segment(text)].filter(part=>part.isWordLike).length;}

// PDF text from tracked (letter-spaced) headings arrives as "D I A G N O S T I C S"; join such runs back into words so they
// are counted and translated as one word.
export function collapseSpacedLetters(text:string){return text.replace(/(?<![\p{L}\p{N}])(?:\p{L} ){3,}\p{L}(?![\p{L}\p{N}])/gu,m=>m.replace(/ /g,''));}
