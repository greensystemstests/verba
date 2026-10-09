// Word count used for quotes and automatic document analysis (letters and numbers, any script).
export function sourceWordCount(text:string){return [...new Intl.Segmenter(undefined,{granularity:'word'}).segment(text)].filter(part=>part.isWordLike).length;}
