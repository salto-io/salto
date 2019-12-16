import * as moo from 'moo'

export const WILDCARD = '****dynamic****'

const lexer = moo.states({
  main: {
    wildcard: WILDCARD,
    mlStart: { match: /<<EOF[ \t]*\n/, lineBreaks: true, push: 'multilineString' },
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
    wildcard: WILDCARD,
    reference: { match: /\$\{[ \t]*[\d\w.]+[ \t]*\}/, value: s => s.slice(2, -1).trim() },
    dq: { match: '"', pop: 1 },
    content: { match: /[^\\](?=")|.+?[^\\](?=\$\{|"|\n)/, lineBreaks: false },
    invalidSytax: { match: /[^ ]+/, error: true },
  },
  multilineString: {
    wildcard: WILDCARD,
    reference: { match: /\$\{[ \t]*[\d\w.]+[ \t]*\}/, value: s => s.slice(2, -1).trim() },
    mlEnd: { match: /^[ \t]*EOF/, pop: 1 },
    content: { match: /^.*\n/, lineBreaks: true },
    invalidSytax: { match: /[^ ]+/, error: true },
  },
})

export default lexer
