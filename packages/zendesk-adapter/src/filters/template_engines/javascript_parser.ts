/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { CallExpression, parse, VariableDeclaration } from 'acorn'
import { simple as walkSimple } from 'acorn-walk'

const matchVariableDeclarationWithPrefix = (node: VariableDeclaration, prefix: string, matches: string[]): void => {
  node.declarations.forEach(declarationNode => {
    if (
      declarationNode.id.type === 'Identifier' &&
      declarationNode.id.name.startsWith(prefix) &&
      declarationNode.init &&
      declarationNode.init.type === 'Literal' &&
      typeof declarationNode.init.value === 'string'
    ) {
      matches.push(declarationNode.init.value)
    }
  })
}
const matchJQuerySelector = (node: CallExpression, matches: string[]): void => {
  const { callee } = node
  if (callee.type === 'Identifier' && callee.name === '$' && node.arguments.length === 1) {
    const selectorArg = node.arguments[0]
    if (selectorArg && selectorArg.type === 'Literal' && typeof selectorArg.value === 'string') {
      matches.push(selectorArg.value)
    }
  }
}
export const parsePotentialReferencesByPrefix = (content: string, prefix: string): string[] => {
  const ast = parse(content, { ecmaVersion: 2020, locations: true })
  const matches: string[] = []

  walkSimple(ast, {
    VariableDeclaration(node) {
      matchVariableDeclarationWithPrefix(node, prefix, matches)
    },
    CallExpression(node) {
      matchJQuerySelector(node, matches)
    },
  })

  return matches
}
