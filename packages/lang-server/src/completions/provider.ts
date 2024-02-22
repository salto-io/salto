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
import _ from 'lodash'

import { collections } from '@salto-io/lowerdash'
import {
  isInsertText,
  Suggestions,
  SuggestionsResolver,
  keywordSuggestions,
  typesSuggestions,
  isSuggestions,
  inheritanceSuggestions,
  annoSuggestions,
  eqSuggestions,
  annoValueSuggestions,
  instanceSuggestions,
  fieldSuggestions,
  fieldValueSuggestions,
  typeBodySuggestions,
} from './suggestions'
import { PositionContext, EditorPosition } from '../context'
import { EditorWorkspace } from '../workspace'

const MAX_NUM_OF_SUGGESTIONS = 100
const { awu } = collections.asynciterable
type LineType = 'empty' | 'type' | 'typeBody' | 'field' | 'annotation' | 'instance' | 'attr' | 'fieldList' | 'annoList'
export interface SaltoCompletion {
  label: string
  insertText: string
  filterText: string
}

const LINE_SUGGESTIONS: { [key in LineType]: SuggestionsResolver[] } = {
  // <keyword/instance_type> ...
  empty: [keywordSuggestions],
  // <keyword> <type_name> (is <primitive_type> )
  type: [keywordSuggestions, typesSuggestions, isSuggestions, inheritanceSuggestions],
  // <field_type OR annotation name>
  typeBody: [typeBodySuggestions],
  // <field_type>
  field: [typesSuggestions],
  // <annotationName> = <value>
  annotation: [annoSuggestions, eqSuggestions, annoValueSuggestions],
  // <instanceType> <instance_name>
  instance: [typesSuggestions, instanceSuggestions],
  // <fieldName> = <value>
  attr: [fieldSuggestions, eqSuggestions, fieldValueSuggestions],
  // <value>
  fieldList: [fieldValueSuggestions],
  // <value>
  annoList: [annoValueSuggestions],
}

const getLineTokens = (line: string): string[] => {
  const quoteIndex = _([line.indexOf('"'), line.indexOf("'")])
    .filter(i => i >= 0)
    .min()
  const parts = quoteIndex
    ? [
        ...line
          .substring(0, quoteIndex)
          .split(' ')
          .filter(p => p),
        line.substring(quoteIndex - 1),
      ]
    : line.split(' ')
  return parts.filter(t => t !== 'list')
}

const isDef = (context: PositionContext, position: EditorPosition): boolean => {
  if (context.ref && context.ref.path.length > 0) {
    return false
  }
  return position.line === context.range.start.line
}

const getLineType = (context: PositionContext, lineTokens: string[], position: EditorPosition): LineType => {
  const isDefLine = isDef(context, position)
  if (context.type === 'type' && isDefLine) {
    return 'type'
  }
  if (context.type === 'type' && !isDefLine && _.isEmpty(context.ref?.path) && _.isEmpty(lineTokens)) {
    return 'typeBody'
  }
  if (context.type === 'type' && !isDefLine) {
    return context.ref?.isList && !lineTokens[0] ? 'annoList' : 'annotation'
  }
  if (context.type === 'field' && isDefLine) {
    return 'field'
  }
  if (context.type === 'field' && !isDefLine) {
    return context.ref?.isList && !lineTokens[0] ? 'annoList' : 'annotation'
  }
  if (context.type === 'instance' && isDefLine) {
    return 'instance'
  }
  if (context.type === 'instance' && !isDefLine) {
    return context.ref && context.ref.isList && !lineTokens[0] ? 'fieldList' : 'attr'
  }
  // If we reached this point we are in global scope, which means that
  // either we are in one of the following:
  // - a partial type def line
  if (lineTokens[0] === 'type') {
    return 'type'
  }
  // - a partial instance def line (or a undefined line not handle right now)
  if (lineTokens.join('').length > 0) {
    return 'instance'
  }
  // - empty line
  return 'empty'
}

const removeLinePrefix = (line: string): string => {
  const parts = line.split(/[}[\],;]|[^$]{/g)
  return _.trimStart(parts[parts.length - 1])
}

const createCompletionItems = (suggestions: Suggestions): Promise<SaltoCompletion[]> =>
  awu(suggestions)
    .map(suggestion => {
      const label = isInsertText(suggestion) ? suggestion.label : suggestion
      const insertText = isInsertText(suggestion) ? suggestion.insertText : suggestion
      const filterText = isInsertText(suggestion) && suggestion.filterText ? suggestion.filterText : label
      return {
        label,
        insertText,
        filterText,
      }
    })
    .take(MAX_NUM_OF_SUGGESTIONS)
    .toArray()

// Returns a list of suggestions for the current line.
// Note - line includes all of the characters in the line *before* the cursor
// The line is stripped of its prefix (which is not a part of the line. this
// allows in line attr def a = {<only this is the line>})
// Once stripped and tokenized, we count the existing tokens and give
// the suggestions to the last token which is the token which we want
// to complete. (We return all values, VS filter by token prefix)
// The token to needed types mapping is in LINE_SUGGESTIONS.
export const provideWorkspaceCompletionItems = async (
  workspace: EditorWorkspace,
  context: PositionContext,
  line: string,
  position: EditorPosition,
): Promise<SaltoCompletion[]> => {
  const tokens = getLineTokens(removeLinePrefix(line))
  const lineType = getLineType(context, tokens, position)

  const elements =
    context.range.filePath !== undefined
      ? await workspace.getElementSourceOfPath(context.range.filePath)
      : await workspace.elements

  const suggestionsParams = {
    elements,
    tokens,
    ref: context.ref,
  }
  const lineSuggestions = LINE_SUGGESTIONS[lineType]
  const tokenSuggestions = lineSuggestions[tokens.length - 1]
  const suggestions = tokenSuggestions ? await tokenSuggestions(suggestionsParams) : awu([])
  return createCompletionItems(suggestions)
}
