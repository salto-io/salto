import _ from 'lodash'

import {
  isInsertText, Suggestions, SuggestionsResolver, keywordSuggestions, typesSuggestions,
  isSuggestions, inheritanceSuggestions, annoSuggestions, eqSugestions,
  annoValueSuggestions, instanceSuggestions, fieldSuggestions, fieldValueSuggestions,
} from './suggestions'
import { PositionContext, EditorPosition } from '../context'
import { SaltoWorkspace } from '../workspace'

type LineType = 'empty'|'type'|'field'|'annotation'|'instance'|'attr'|'fieldList'|'annoList'
export interface SaltoCompletion {
  label: string
  insertText: string
  reInvoke: boolean
}

const LINE_SUGGESTIONS: {[key in LineType]: SuggestionsResolver[] } = {
  // <keyword/instance_type> ...
  empty: [keywordSuggestions],
  // <keyword> <type_name> (is <primitive_type> )
  type: [keywordSuggestions, typesSuggestions, isSuggestions, inheritanceSuggestions],
  // <field_type>
  field: [typesSuggestions],
  // <annotationName> = <value>
  annotation: [annoSuggestions, eqSugestions, annoValueSuggestions],
  // <instanceType> <instance_name>
  instance: [typesSuggestions, instanceSuggestions],
  // <fieldName> = <value>
  attr: [fieldSuggestions, eqSugestions, fieldValueSuggestions],
  // <value>
  fieldList: [fieldValueSuggestions],
  // <value>
  annoList: [annoValueSuggestions],
}

const getLineTokens = (line: string): string[] => (
  line.replace(/\s+/g, ' ')
    .split(' ')
  // Ignoring the list token as it has no effect on the rest of the line
    .filter(t => t !== 'list')
)

const isDef = (
  context: PositionContext,
  position: EditorPosition,
): boolean => {
  if (context.ref && context.ref.path.length > 0) {
    return false
  }
  return (position.line === context.range.start.line)
}

const getLineType = (
  context: PositionContext,
  lineTokens: string[],
  position: EditorPosition
): LineType => {
  const isDefLine = isDef(context, position)
  if (context.type === 'type' && isDefLine) {
    return 'type'
  }
  if (context.type === 'type' && !isDefLine) {
    return 'field'
  }
  if (context.type === 'field' && isDefLine) {
    return 'field'
  }
  if (context.type === 'field' && !isDefLine) {
    return (context.ref && context.ref.isList) ? 'annoList' : 'annotation'
  }
  if (context.type === 'instance' && isDefLine) {
    return 'instance'
  }
  if (context.type === 'instance' && !isDefLine) {
    return (context.ref && context.ref.isList) ? 'fieldList' : 'attr'
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
  const LINE_ENDERS = ['\\{', '\\}', '\\[', '\\]', ',', ';']
  const lineTokenizer = new RegExp(`[${LINE_ENDERS.join('')}]`)
  const parts = line.split(lineTokenizer)
  return _.trimStart(parts[parts.length - 1])
}

const createCompletionItems = (
  suggestions: Suggestions,
  reInvoke: boolean
): SaltoCompletion[] => suggestions.map(suggestion => {
  const label = isInsertText(suggestion) ? suggestion.label : suggestion
  const insertBody = isInsertText(suggestion) ? suggestion.insertText : suggestion
  const insertSuffix = reInvoke ? ' ' : ''
  const insertText = [insertBody, insertSuffix].join('')
  return { label, reInvoke, insertText }
})

// Returns a list of suggestions for the current line.
// Note - line includes all of the charecters in the line *before* the cursor
// The line is stripped of its prefix (which is not a part of the line. this
// allows in line attr def a = {<only this is the line>})
// Once stripped and tokenized, we count the existing tokens and give
// the suggestions to the last token which is the token which we want
// to complete. (We reurn all values, VS filter by token prefix)
// The token to needed types mapping is in LINE_SUGGESTIONS.
export const provideWorkspaceCompletionItems = (
  workspace: SaltoWorkspace,
  context: PositionContext,
  line: string,
  position: EditorPosition
): SaltoCompletion[] => {
  const tokens = getLineTokens(removeLinePrefix(line))
  const lineType = getLineType(context, tokens, position)
  const suggestionsParams = { workspace, tokens, ref: context.ref }
  const lineSuggestions = LINE_SUGGESTIONS[lineType]
  const tokenSuggestions = lineSuggestions[tokens.length - 1]
  const suggestions = (tokenSuggestions) ? tokenSuggestions(suggestionsParams) : []
  const reInvoke = (tokens.length < lineSuggestions.length)
  return createCompletionItems(suggestions, reInvoke)
}
