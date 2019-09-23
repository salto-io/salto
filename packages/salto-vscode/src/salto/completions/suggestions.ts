import _ from 'lodash'
import {
  Type, Field, isObjectType, isInstanceElement, isPrimitiveType,
  isField, PrimitiveTypes, BuiltinTypes, isType, Value, getField,
  getFieldNames, getFieldType, getAnnotationKey, ElemID,
} from 'adapter-api'

import { SaltoWorkspace } from '../workspace'
import { ContextReference } from '../context'

interface InsertText {
  label: string
  insertText: string
}
type Suggestion = string|InsertText
export type Suggestions = Suggestion[]

interface SuggestionsParams {
  workspace: SaltoWorkspace
  ref?: ContextReference
  tokens: string[]
}
export type SuggestionsResolver = (params: SuggestionsParams) => Suggestions

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isInsertText = (value: any): value is InsertText => (
  value.label !== undefined && value.insertText !== undefined
)

const getRestrictionValues = (annotatingElem: Type|Field, valueType: Type): Value[]|undefined => {
  const restrictions = annotatingElem.annotations[Type.RESTRICTION]
                       || valueType.annotations[Type.RESTRICTION]
  return (restrictions && restrictions.values)
}

export const valueSuggestions = (
  ref: ContextReference,
  annotatingElem: Type|Field,
  valueType: Type
): Suggestions => {
  // If the annotating element is a list and we are not in a list content
  // we need to created one
  if (isField(annotatingElem) && annotatingElem.isList && !ref.isList) {
    return [{ label: '[]', insertText: '[$0]' }]
  }

  // Now that we know we are in the actual value - lets use it!
  const restrictionValues = getRestrictionValues(annotatingElem, valueType)
  if (restrictionValues) {
    return restrictionValues.map(v => JSON.stringify(v))
  }
  if (isObjectType(valueType)) {
    return [{ label: '{}', insertText: '{$0}' }]
  }
  if (isPrimitiveType(valueType) && valueType.primitive === PrimitiveTypes.STRING) {
    return [{ label: '""', insertText: '"$0"' }]
  }
  if (isPrimitiveType(valueType) && valueType.primitive === PrimitiveTypes.BOOLEAN) {
    return ['true', 'false']
  }
  return []
}

export const fieldSuggestions = (params: SuggestionsParams): Suggestions => {
  if (!(params.ref && isInstanceElement(params.ref.element))) return []
  return getFieldNames(params.ref.element.type, params.ref.path)
}

export const fieldValueSuggestions = (params: SuggestionsParams): Suggestions => {
  if (!(params.ref && isInstanceElement(params.ref.element))) return []
  const attrName = params.tokens[0]
  const refType = (params.ref.path)
    ? getFieldType(params.ref.element.type, params.ref.path.split(ElemID.NAMESPACE_SEPERATOR))
    : params.ref.element.type

  const valueField = (attrName && isObjectType(refType)) ? refType.fields[attrName]
    : getField(params.ref.element.type, params.ref.path.split('_'))

  return (valueField) ? valueSuggestions(params.ref, valueField, valueField.type) : []
}

export const annoSuggestions = (params: SuggestionsParams): Suggestions => {
  // Utility function that is only used in this function
  if (!(params.ref && isField(params.ref.element))) return []

  if (!params.ref.path) {
    return _.keys(params.ref.element.type.annotationTypes)
  }
  const { annoName, annoType } = getAnnotationKey(
    params.ref.element.type.annotationTypes,
    params.ref.path
  )
  if (annoName && isObjectType(annoType)) {
    const annoPath = params.ref.path.slice(annoName.length)
    return getFieldNames(annoType, annoPath)
  }
  return []
}


export const annoValueSuggestions = (params: SuggestionsParams): Suggestions => {
  if (!(params.ref && isField(params.ref.element))) return []
  const annoName = params.tokens[0]
  const annoType = params.ref.element.type.annotationTypes[annoName]
  if (annoType && params.ref.path) {
    const annoPath = params.ref.path.slice(annoName.length)
    const attrField = getField(annoType, annoPath.split(' '))
    return (attrField) ? valueSuggestions(params.ref, attrField, attrField.type) : []
  }
  if (annoType) {
    return valueSuggestions(params.ref, annoType, annoType)
  }
  return []
}


/**
 * Returns a list of all of the types that were defined in the system
 * and who's adapter matches the context allowed adapters.
 */
export const typesSuggestions = (params: SuggestionsParams): Suggestions => {
  const contextAdapter = params.ref && params.ref.element.elemID.adapter
  const mergedElements = params.workspace.mergedElements || [] // may be undefined
  const types = mergedElements.filter(e => isType(e))
  const relevantTypes = (contextAdapter) ? types.filter(
    // We return the builtin types in any context
    e => [contextAdapter, ''].includes(e.elemID.adapter)
  ) : types

  const typeNames = [
    ..._.values(BuiltinTypes),
    ...relevantTypes,
  ].map(e => e.elemID.getFullName())

  const updates = (params.ref && isObjectType(params.ref.element))
    ? _.keys(params.ref.element.fields).map(k => `update ${k}`) : []

  return [
    ...typeNames,
    ...updates,
  ]
}

/**
 * Returns a list of all possible primitives in the inheritance section
 */
export const inheritanceSuggestions = (): Suggestions => ['string', 'number', 'boolean']

/**
 * Returns all known keyword - which are 'type' for type def, and defined types
 * if we are defining an instance
 */
export const keywordSuggestions = (params: SuggestionsParams): Suggestions => [
  'type',
  ...typesSuggestions(params),
]

export const eqSugestions = (): Suggestions => ['=']

export const isSuggestions = (): Suggestions => ['is']

export const instanceSuggestions = (
  params: SuggestionsParams
): Suggestions => (
  params.workspace.mergedElements || []
).filter(e => isInstanceElement(e)).map(e => e.elemID.getFullName())
