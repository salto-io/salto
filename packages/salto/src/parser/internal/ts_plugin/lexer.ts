import * as moo from 'moo'

const lexer = moo.compile({
  multilineString: { match: /<<EOF\n(?:.|\n)*EOF/, lineBreaks: true },
  string: { match: /"(?:[^"\n\\]|\\.)*?"/ },
  // string: /".*?"/,
  number: /\d+\.?\d*/,
  boolean: /true|false/,
  word: /[\d\w.]+/,
  arrOpen: '[',
  arrClose: ']',
  comma: ',',
  cCurly: '}',
  oCurly: '{',
  eq: '=',
  ws: /[ \t]+/,
  comment: /\/\/[^\r\n]*/,
  newline: { match: /[\r\n]+/, lineBreaks: true },
  invalidSytax: { match: /[^ ]+/, error: true },
})

export default lexer
