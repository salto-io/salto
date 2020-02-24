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

const lexer = moo.states({
  main: {
    wildcard: WILDCARD,
    mlStart: { match: /<<EOF[ \t]*\n/, lineBreaks: true, push: 'multilineString' },
    dq: { match: '"', push: 'string' },
    // string: /".*?"/,
    number: /[-+]?\d+\.?\d*/,
    boolean: /true|false/,
    staticFileAsset: { match: /file\(.+\)/, value: s => s.slice(6, -2).trim() },
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
