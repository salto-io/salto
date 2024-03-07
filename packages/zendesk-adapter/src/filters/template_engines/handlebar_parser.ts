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
import { parse } from '@handlebars/parser'
import {
  BlockStatement,
  MustacheStatement,
  Node,
  NumberLiteral,
  PathExpression,
  SubExpression,
} from '@handlebars/parser/types/ast'
import { values } from '@salto-io/lowerdash'

// These are the helper functions that may have potential references in their arguments:
// https://developer.zendesk.com/api-reference/help_center/help-center-templates/helpers/
const RELEVANT_HELPERS = ['is', 'isnt']
const isBlockStatement = (node: Node): node is BlockStatement => node.type === 'BlockStatement'
const isSubExpression = (node: Node): node is SubExpression => node.type === 'SubExpression'
const isPathExpression = (node: Node): node is PathExpression => node.type === 'PathExpression'
const isNumberLiteral = (node: Node): node is NumberLiteral => node.type === 'NumberLiteral'

const extractHelper = (node: MustacheStatement['path'] | BlockStatement['path']): string | undefined => {
  if (isSubExpression(node)) {
    return extractHelper(node.path)
  }
  if (isPathExpression(node)) {
    return typeof node.head === 'string' ? node.head : extractHelper(node.head)
  }
  return undefined // When node is a Literal
}

const extractPotentialIds = (node: Node): NumberLiteral[] | undefined => {
  // The current relevant helpers are only used in block statements.
  // if this changes, we should also check for MustacheStatement
  if (isBlockStatement(node)) {
    const idsFromBlockBody = node.program.body.map(extractPotentialIds)
    const idsFromBlockElse = node.inverse?.body.map(extractPotentialIds)
    const nestedIds = idsFromBlockBody.concat(idsFromBlockElse).filter(values.isDefined).flat()
    const helper = extractHelper(node.path)
    return helper && RELEVANT_HELPERS.includes(helper)
      ? nestedIds.concat(node.params.filter(isNumberLiteral))
      : nestedIds
  }
  return undefined
}

/**
 * Extracts all the number literals from a handlebar template that are used as arguments in relevant helper functions
 * @example parseHandlebarPotentialReferences('Hello {{#is id 12345}}good name{{else}}bad name{{/is}}')
 * // Returns [{ value: 12345, loc: { start: { line: 1, column: 18 }, end: { line: 1, column: 23 } } }]
 */
export const parseHandlebarPotentialReferences = (content: string): NumberLiteral[] => {
  const ast = parse(content)
  const potentialIds = ast.body.map(extractPotentialIds).filter(values.isDefined).flat()
  return potentialIds
}
