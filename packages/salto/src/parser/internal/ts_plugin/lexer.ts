import * as moo from 'moo'

const lexer = moo.states({
  main: {
    multilineString: { match: /<<EOF\n(?:.|\n)*EOF/, lineBreaks: true },
    dq: { match: '"', push: 'string' },
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
  },
  string: {
    reference: { match: /\$\{[ \t]*[\d\w.]+[ \t]*\}/, value: s => s.slice(2, -1).trim() },
    content: { match: /[^"\n(?:${)]+/, lineBreaks: false },
    dq: { match: '"', pop: 1 },
  },
})

export default lexer
