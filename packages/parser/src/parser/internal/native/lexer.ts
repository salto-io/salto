/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import * as moo from 'moo'
import type { SourcePos } from '../types'

export const WILDCARD = '****dynamic****'

export const TRUE = 'true'
export const FALSE = 'false'
export const TOKEN_TYPES = {
  WORD: 'word',
  OCURLY: 'oCurly',
  CCURLY: 'cCurly',
  DOUBLE_QUOTES: 'dq',
  ESCAPE: 'escape',
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
  MERGE_CONFLICT: 'mergeConflict',
  MERGE_CONFLICT_MID: 'mergeConflictMid',
  MERGE_CONFLICT_END: 'mergeConflictEnd',
  CONFLICT_CONTENT: 'mergeConflictContent',
  ERROR: 'error',
}

const WORD_PART = '[a-zA-Z_][\\w.@]*'
const NEWLINE_CHARS = '\r\n\u2028\u2029'
const MULTILINE_CONTENT = new RegExp(`.*[${NEWLINE_CHARS}]`)
const REFERENCE_PART = `\\$\\{[ \\t]*${WORD_PART}[ \\t]*\\}`
const REFERENCE = new RegExp(REFERENCE_PART)

export const rules: Record<string, moo.Rules> = {
  // Regarding ERROR tokens: Each section in the state must have an error token.
  // If there is no error token in a section, an Error is thrown from the lexer, with missing information.
  // With an error token - when there is no lexer match, the error token is returned with the rest of the buffer.
  // We throw our own error with the token and reflect this to the user.
  main: {
    [TOKEN_TYPES.MERGE_CONFLICT]: { match: '<<<<<<<', push: 'mergeConflict' },
    [TOKEN_TYPES.MULTILINE_START]: {
      match: new RegExp(`'''[ \t]*[${NEWLINE_CHARS}]`),
      lineBreaks: true,
      push: 'multilineString',
    },
    [TOKEN_TYPES.DOUBLE_QUOTES]: { match: '"', push: 'string' },
    [TOKEN_TYPES.NUMBER]: /-?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?/,
    [TOKEN_TYPES.LEFT_PAREN]: '(',
    [TOKEN_TYPES.RIGHT_PAREN]: ')',
    [TOKEN_TYPES.ARR_OPEN]: '[',
    [TOKEN_TYPES.ARR_CLOSE]: ']',
    [TOKEN_TYPES.COMMA]: ',',
    [TOKEN_TYPES.CCURLY]: '}',
    [TOKEN_TYPES.OCURLY]: '{',
    [TOKEN_TYPES.EQUAL]: '=',
    [TOKEN_TYPES.WORD]: new RegExp(WORD_PART, 's'),
    [TOKEN_TYPES.COMMENT]: /\/\//,
    [TOKEN_TYPES.WHITESPACE]: { match: /[ \t]+/ },
    [TOKEN_TYPES.NEWLINE]: { match: new RegExp(`[${NEWLINE_CHARS}]+`), lineBreaks: true },
    // The Invalid token is matched when the syntax is not critical - for example in comment content.
    // The parser disregards this token and continues to the next match.
    [TOKEN_TYPES.INVALID]: { match: new RegExp(`[^ \t${NEWLINE_CHARS}]+`) },
    [TOKEN_TYPES.ERROR]: moo.error,
  },
  string: {
    [TOKEN_TYPES.DOUBLE_QUOTES]: { match: '"', pop: 1 },
    // This handles regular escapes, and unicode characters
    [TOKEN_TYPES.ESCAPE]: { match: /\\[^u]|\\u[0-9a-fA-F]{4}/ },
    [TOKEN_TYPES.CONTENT]: { match: /[^"\\\r\n]+/, lineBreaks: false },
    // In this context we do not treat unicode newlines as new lines because the dump code
    // can put them in a single line string
    [TOKEN_TYPES.NEWLINE]: { match: /[\r\n]+/, lineBreaks: true, pop: 1 },
    [TOKEN_TYPES.ERROR]: moo.error,
  },
  multilineString: {
    [TOKEN_TYPES.MULTILINE_END]: { match: /^[ \t]*'''/, pop: 1 },
    [TOKEN_TYPES.CONTENT]: { match: MULTILINE_CONTENT, lineBreaks: true },
    [TOKEN_TYPES.ERROR]: moo.error,
  },
  mergeConflict: {
    [TOKEN_TYPES.MERGE_CONFLICT_MID]: '=======',
    [TOKEN_TYPES.MERGE_CONFLICT_END]: { match: '>>>>>>>', pop: 1 },
    [TOKEN_TYPES.CONFLICT_CONTENT]: { match: MULTILINE_CONTENT, lineBreaks: true },
    [TOKEN_TYPES.ERROR]: moo.error,
  },
}

// Note: These rules are used for both single and multiline strings.
// They are not fully correct for the two cases, specifically, in single line strings "\'''" is no a valid escape token
// and in multiline strings it is valid.
// Ideally we should use different rules for the two cases, but this is more complex to implement.
// We chose to err on the side of having bigger tokens since down the line the code for single line strings merges all tokens anyway
// whereas the code for multiline strings may sometimes consume token-by-token which makes it more sensitive to wrong token splits.
const stringWithReferencesRules = moo.compile({
  // This handles escaped multiline end (\'''),regular escapes, unicode escapes and escaped template markers ('\${')
  [TOKEN_TYPES.ESCAPE]: { match: /(?:\\'''|\\[^$u]|\\u[0-9a-fA-F]{4}|\\\$\{?)+/ },
  [TOKEN_TYPES.REFERENCE]: { match: REFERENCE, value: s => s.slice(2, -1).trim() },
  // Template markers are added to prevent incorrect parsing of user created strings that look like Salto references.
  [TOKEN_TYPES.CONTENT]: {
    match: new RegExp(`[^\\${NEWLINE_CHARS}]+?(?=\\$\\{|[${NEWLINE_CHARS}\\\\]|$)`),
    lineBreaks: false,
  },
  [TOKEN_TYPES.NEWLINE]: { match: new RegExp(`[${NEWLINE_CHARS}]+`), lineBreaks: true },
  [TOKEN_TYPES.ERROR]: moo.error,
})

export type LexerToken = Required<moo.Token>

export class NoSuchElementError extends Error {
  constructor(public lastValidToken?: LexerToken) {
    super('All lexer tokens have already been consumed.')
  }
}

class InvalidLexerTokenError extends Error {
  constructor() {
    super('All lexer tokens must have a type.')
  }
}

export class LexerErrorTokenReachedError extends Error {
  constructor(public lastValidToken?: LexerToken) {
    super('Invalid syntax')
  }
}

export class UnresolvedMergeConflictError extends Error {
  constructor(public lastValidToken?: LexerToken) {
    super('Unresolved merge conflict')
  }
}

const isAtBeginningOfLine = (token: moo.Token): boolean => token.col === 1

const validateToken = (token?: moo.Token): token is LexerToken => {
  if (token === undefined) {
    return false
  }
  if (token.type === undefined) {
    throw new InvalidLexerTokenError()
  } else if (token.type === TOKEN_TYPES.MERGE_CONFLICT) {
    if (isAtBeginningOfLine(token)) {
      throw new UnresolvedMergeConflictError(token as LexerToken)
    } else {
      throw new InvalidLexerTokenError()
    }
  } else if (token.type === TOKEN_TYPES.ERROR) {
    throw new LexerErrorTokenReachedError(token as LexerToken)
  }
  return true
}

export const stringLexerFromString = (src: string): LexerToken[] => {
  stringWithReferencesRules.reset(src)
  return Array.from(stringWithReferencesRules).filter(validateToken)
}

export const stringLexer = (stringTokens: LexerToken[], start: SourcePos): LexerToken[] =>
  stringLexerFromString(stringTokens.map(t => t.text).join('')).map(token => ({
    ...token,
    col: start.col + token.col,
    line: start.line + token.line - 1,
    offset: start.byte + token.offset + 1,
  }))

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

    while (token && (token.type === TOKEN_TYPES.WHITESPACE || token.type === TOKEN_TYPES.COMMENT)) {
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
    if (!ignoreNewlines && this.peeked?.type === TOKEN_TYPES.NEWLINE && this.peekedNoNewline !== undefined) {
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
