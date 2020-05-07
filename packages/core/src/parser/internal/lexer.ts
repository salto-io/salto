/*
*                      Copyright 2020 Salto Labs Ltd.
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

export const rules: Record<string, moo.Rules> = {
  main: {
    wildcard: WILDCARD,
    mlStart: { match: /'''[ \t]*[(\r\n)(\n)]/, lineBreaks: true, push: 'multilineString' },
    dq: { match: '"', push: 'string' },
    number: /-?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?/,
    boolean: /true|false/,
    word: /[a-zA-Z_][\w.]*(?!\*\*\*\*dynamic\*\*\*\*)/s,
    spec: /[[\](){},=]/,
    lparen: '(',
    rparen: ')',
    arrOpen: '[',
    arrClose: ']',
    comma: ',',
    cCurly: '}',
    oCurly: '{',
    eq: '=',
    newline: { match: /(?:(?:(?:[ \t]+)|(?:\/\/[^\r\n]*))*(?:[\r\n]+)(?:(?:[ \t]+)|(?:\/\/[^\r\n]*))*)+/, lineBreaks: true },
    ws: /[ \t]+/,
    comment: /\/\/[^\r\n]*/,
    invalidSyntax: { match: /[^ ]+/, error: true },
  },
  string: {
    wildcard: WILDCARD,
    reference: { match: /\$\{[ \t]*[\d\w.]+[ \t]*\}/, value: s => s.slice(2, -1).trim() },
    dq: { match: '"', pop: 1 },
    content: { match: /[^\\](?=")|[^\r\n]+?[^\\](?=\$\{|"|\n)/s, lineBreaks: false },
    invalidSyntax: { match: /[^ ]+/, error: true },
  },
  multilineString: {
    wildcard: WILDCARD,
    reference: { match: /\$\{[ \t]*[\d\w.]+[ \t]*\}/, value: s => s.slice(2, -1).trim() },
    mlEnd: { match: /^[ \t]*'''/, pop: 1 },
    content: { match: /.*\\\$\{.*[(\r\n)(\n)]|.*?(?=\$\{)|.*[(\r\n)(\n)]/, lineBreaks: true },
    invalidSyntax: { match: /[^ ]+/, error: true },
  },
}

const lexer = moo.states(rules)

export default lexer
