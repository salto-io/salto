/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import * as moo from 'moo'

export const WILDCARD = '****dynamic****'

export const TRUE = 'true'
export const FALSE = 'false'
export const TOKEN_TYPES = {
  WORD: 'word',
  OCURLY: 'oCurly',
  CCURLY: 'cCurly',
  DOUBLE_QUOTES: 'dq',
  WHITESPACE: 'whitespace',
  EQUAL: 'equal',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARR_OPEN: 'arrOpen',
  ARR_CLOSE: 'arrClose',
  COMMA: 'comma',
  NEWLINE: 'newline',
  CONTENT: 'content',
  REFERENCE: 'reference',
  LEFT_PAREN: 'lparen',
  RIGHT_PAREN: 'rparen',
  MULTILINE_START: 'mlstart',
  MULTILINE_END: 'mlend',
  COMMENT: 'comment',
  INVALID: 'invalid',
}

export const rules: Record<string, moo.Rules> = {
  main: {
    [TOKEN_TYPES.MULTILINE_START]: { match: /'''[ \t]*[(\r\n)(\n)]/, lineBreaks: true, push: 'multilineString' },
    [TOKEN_TYPES.DOUBLE_QUOTES]: { match: '"', push: 'string' },
    [TOKEN_TYPES.NUMBER]: /-?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?/,
    [TOKEN_TYPES.BOOLEAN]: new RegExp(`${TRUE}|${FALSE}`),
    [TOKEN_TYPES.LEFT_PAREN]: '(',
    [TOKEN_TYPES.RIGHT_PAREN]: ')',
    [TOKEN_TYPES.ARR_OPEN]: '[',
    [TOKEN_TYPES.ARR_CLOSE]: ']',
    [TOKEN_TYPES.COMMA]: ',',
    [TOKEN_TYPES.CCURLY]: '}',
    [TOKEN_TYPES.OCURLY]: '{',
    [TOKEN_TYPES.EQUAL]: '=',
    [TOKEN_TYPES.WORD]: /[a-zA-Z_][\w.@]*/s,
    [TOKEN_TYPES.COMMENT]: /\/\//,
    [TOKEN_TYPES.WHITESPACE]: { match: /[ \t]+/ },
    [TOKEN_TYPES.NEWLINE]: { match: /[\r\n]+/, lineBreaks: true },
    [TOKEN_TYPES.INVALID]: { match: /[^ \n]+/, error: true },
  },
  string: {
    [TOKEN_TYPES.REFERENCE]: { match: /\$\{[ \t]*[\d\w.]+[ \t]*\}/, value: s => s.slice(2, -1).trim() },
    [TOKEN_TYPES.DOUBLE_QUOTES]: { match: '"', pop: 1 },
    [TOKEN_TYPES.CONTENT]: { match: /[^\\](?=")|[^\r\n]+?[^\\](?=\$\{|"|\n)/s, lineBreaks: false },
    [TOKEN_TYPES.NEWLINE]: { match: /[\r\n]+/, lineBreaks: true, pop: 1 },
  },
  multilineString: {
    [TOKEN_TYPES.REFERENCE]: { match: /\$\{[ \t]*[\d\w.]+[ \t]*\}/, value: s => s.slice(2, -1).trim() },
    [TOKEN_TYPES.MULTILINE_END]: { match: /^[ \t]*'''/, pop: 1 },
    [TOKEN_TYPES.CONTENT]: { match: /.*\\\$\{.*[(\r\n)(\n)]|.*?(?=\$\{)|.*[(\r\n)(\n)]/, lineBreaks: true },
  },
}

export type LexerToken = Required<moo.Token>

export class NoSuchElementError extends Error {
  constructor(public lastValidToken?: LexerToken) {
    super("All of the lexer's token has already been consumed.")
  }
}

class InvalidLexerTokenError extends Error {
  constructor() {
    super('All lexer tokens must have a type.')
  }
}

const validateToken = (token?: moo.Token): token is LexerToken => {
  if (token === undefined) {
    return false
  }
  if (token.type === undefined) {
    throw new InvalidLexerTokenError()
  }
  return true
}

class PeekableLexer {
    private lexer: moo.Lexer
    private peeked?: LexerToken
    private peekedNoNewline?: LexerToken
    constructor(src: string) {
      this.lexer = moo.states(rules)
      this.lexer.reset(src)
    }

    private advance(): LexerToken | undefined {
      let token = this.lexer.next()

      while (token && (token.type === TOKEN_TYPES.WHITESPACE
        || token.type === TOKEN_TYPES.COMMENT)) {
        if (token.type === TOKEN_TYPES.COMMENT) {
          while (token && token.type !== TOKEN_TYPES.NEWLINE) {
            token = this.lexer.next()
          }
        }
        token = this.lexer.next()
      }
      return validateToken(token) ? token : undefined
    }

    public peek(ignoreNewlines = true): LexerToken | undefined {
      if (this.peeked === undefined) {
        this.peeked = this.advance()
      }
      if (!ignoreNewlines) {
        return this.peeked
      }
      if (this.peekedNoNewline === undefined) {
        let token = this.peeked
        while (token && token.type === TOKEN_TYPES.NEWLINE) {
          token = this.advance()
        }
        this.peekedNoNewline = token
      }

      return this.peekedNoNewline
    }

    public next(ignoreNewlines = true): LexerToken {
      if (!ignoreNewlines
        && this.peeked?.type === TOKEN_TYPES.NEWLINE
        && this.peekedNoNewline !== undefined) {
        const t = this.peeked
        this.peeked = this.peekedNoNewline
        return t
      }
      const token = this.peek(ignoreNewlines)

      if (!token) {
        throw new NoSuchElementError(this.peeked)
      }
      this.peeked = undefined
      this.peekedNoNewline = undefined
      return token
    }

    public recover(stopTokens: string[], advancePastNewlines = true): void {
      // This is handling a special case in which the recover char
      // is not a new line. In such case, there is a chance that the
      // char is already loaded to the peekNoNewLine attr, which means
      // that the lexer has already advanced
      while (!stopTokens.includes(this.peek(false)?.type || '')) {
        this.next(false)
      }
      if (advancePastNewlines && this.peek(false)?.type === TOKEN_TYPES.NEWLINE) {
        this.next(false)
      }
    }
}
export default PeekableLexer
