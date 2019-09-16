import _ from 'lodash'

import {
  Suggestions, SuggestionsResolver, keywordSuggestions, typesSuggestions,
  isSuggestions, inheritanceSuggestions, annoSuggestions, eqSugestions,
  annoValueSuggestions, instanceSuggestions, fieldSuggestions, fieldValueSuggestions,
} from './suggestions'
import { PositionContext } from '../context'
import { SaltoWorkspace } from '../workspace'

type LineType = 'empty'|'type'|'field'|'annotation'|'instance'|'attr'
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
}

const getLineTokens = (line: string): string[] => line.replace(/\s+/g, ' ').split(' ')

const getLineType = (context: PositionContext, lineTokens: string[]): LineType => {
  if (context.type === 'type' && context.part === 'definition') {
    return 'type'
  }
  if (context.type === 'type' && context.part === 'body') {
    return 'field'
  }
  if (context.type === 'field' && context.part === 'definition') {
    return 'field'
  }
  if (context.type === 'field' && context.part === 'body') {
    return 'annotation'
  }
  if (context.type === 'instance' && context.part === 'definition') {
    return 'instance'
  }
  if (context.type === 'instance' && context.part === 'body') {
    return 'attr'
  }
  // If we reached this point we are in global scope, which means that
  // either we are in one of the following:
  // - a parital type def line
  if (lineTokens[0] === 'type') {
    return 'type'
  }
  // - a parital instance def line (or a undefined line not handle right now)
  if (lineTokens.join('').length > 0) {
    return 'instance'
  }
  // - empty line
  return 'empty'
}

const removeLinePrefix = (line: string): string => {
  const LINE_ENDERS = ['\\{', '\\}', '\\[', '\\]', ',', ';']
  const lineEnderReg = new RegExp(`[${LINE_ENDERS.join('')}]`)
  const parts = line.split(lineEnderReg)
  return _.trimStart(parts[parts.length - 1])
}

const createCompletionItems = (
  suggestions: Suggestions,
  reInvoke: boolean
): SaltoCompletion[] => suggestions.map(label => {
  const insertText = (reInvoke) ? `${label} ` : label
  return { label, reInvoke, insertText }
})

export const provideWorkspaceCompletionItems = (
  workspace: SaltoWorkspace,
  context: PositionContext,
  line: string
): SaltoCompletion[] => {
  const tokens = getLineTokens(removeLinePrefix(line))
  const lineType = getLineType(context, tokens)
  const suggestionsParams = { workspace, tokens, ref: context.ref }
  const lineSuggestions = LINE_SUGGESTIONS[lineType]
  const tokenSuggestions = lineSuggestions[tokens.length - 1]
  const suggestions = (tokenSuggestions) ? tokenSuggestions(suggestionsParams) : []
  const reInvoke = (tokens.length < lineSuggestions.length)
  return createCompletionItems(suggestions, reInvoke)
}
