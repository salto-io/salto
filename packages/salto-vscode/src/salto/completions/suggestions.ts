import _ from 'lodash'
import {
  Type, Field, ObjectType, isObjectType, isInstanceElement, isPrimitiveType,
  isField, PrimitiveTypes, BuiltinTypes, isType,
} from 'adapter-api'

import { SaltoWorkspace } from '../workspace'
import { ContextReference } from '../context'

export type Suggestions = string[]
interface SuggestionsParams {
  workspace: SaltoWorkspace
  ref?: ContextReference
  tokens: string[]
}
export type SuggestionsResolver = (params: SuggestionsParams) => Suggestions

const getFieldFromPath = (baseType: Type, pathParts: string[]): Field|undefined => {
  // This is a little tricky. Since many fields can have _ in them,
  // and we can't tell of the _ is path seperator or a part of the
  // the path name. As long as path is not empty we will try to advance
  // in the recursion in two ways - First we try only the first token.
  // If it fails, we try to first to tokens (the recursion will take)
  // care of the next "join"
  const [curPart, ...restOfParts] = pathParts
  if (_.isEmpty(curPart) || !isObjectType(baseType)) {
    return undefined
  }

  if (baseType.fields[curPart]) {
    return _.isEmpty(restOfParts) ? baseType.fields[curPart]
      : getFieldFromPath(baseType.fields[curPart].type, restOfParts)
  }
  // Firdt token is no good, we check if it is a part of a longer name
  const nextCur = [curPart, restOfParts[0]].join('_')
  const nextRest = restOfParts.slice(1)
  return getFieldFromPath(baseType, [nextCur, ...nextRest])
}

const getFieldTypeFromPath = (baseType: Type, pathParts: string[]): Type|undefined => {
  const field = getFieldFromPath(baseType, pathParts)
  return (field) ? field.type : undefined
}

export const attrSuggestions = (refType: ObjectType, path: string): Suggestions => {
  if (!path) {
    return _.keys(refType.fields)
  }
  const pathField = getFieldFromPath(refType, path.split('_'))
  if (pathField && isObjectType(pathField.type)) {
    return _.keys(pathField.type.fields)
  }
  return []
}

export const attrValueSuggestion = (refElem: Type|Field, valueType: Type): Suggestions => {
  const restrictions = refElem.annotations[Type.RESTRICTION]
             || valueType.annotations[Type.RESTRICTION]
  if (restrictions && restrictions.values) {
    return restrictions.values.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (v: any) => JSON.stringify(v) // TODO HCL dump
    )
  }
  if (isObjectType(valueType)) {
    return ['{}']
  }
  if (isPrimitiveType(valueType) && valueType.primitive === PrimitiveTypes.STRING) {
    return ['""']
  }
  if (isPrimitiveType(valueType) && valueType.primitive === PrimitiveTypes.BOOLEAN) {
    return ['true', 'false']
  }
  return []
}

export const fieldSuggestions = (params: SuggestionsParams): Suggestions => {
  if (!(params.ref && isInstanceElement(params.ref.element))) return []
  return attrSuggestions(params.ref.element.type, params.ref.path)
}

export const fieldValueSuggestions = (params: SuggestionsParams): Suggestions => {
  if (!(params.ref && isInstanceElement(params.ref.element))) return []
  const attrName = params.tokens[0]
  const refType = (params.ref.path)
    ? getFieldTypeFromPath(params.ref.element.type, params.ref.path.split('_'))
    : params.ref.element.type

  if (isObjectType(refType)) {
    const valueField = refType.fields[attrName]
    return (valueField) ? attrValueSuggestion(valueField, valueField.type) : []
  }
  return []
}

export const annoSuggestions = (params: SuggestionsParams): Suggestions => {
  // Utility function that is only used in this function
  const getAnnotationKeyFromPath = (
    annotations: {[key: string]: Type},
    path: string
  ): {annoType?: Type; annoName?: string} => {
    // Looking for the longest key in annotations that start with pathParts
    const annoName = _(annotations).keys().filter(k => path.startsWith(k))
      .sortBy(k => k.length)
      .value()[0]
    const annoType = (annoName) ? annotations[annoName] : undefined
    return { annoName, annoType }
  }

  if (!(params.ref && isField(params.ref.element))) return []

  if (!params.ref.path) {
    return _.keys(params.ref.element.type.annotationTypes)
  }
  const { annoName, annoType } = getAnnotationKeyFromPath(
    params.ref.element.type.annotationTypes,
    params.ref.path
  )
  if (annoName && isObjectType(annoType)) {
    const annoPath = params.ref.path.slice(annoName.length)
    return attrSuggestions(annoType, annoPath)
  }
  return []
}


export const annoValueSuggestions = (params: SuggestionsParams): Suggestions => {
  if (!(params.ref && isField(params.ref.element))) return []
  const annoName = params.tokens[0]
  const annoType = params.ref.element.type.annotationTypes[annoName]
  if (annoType && params.ref.path) {
    const annoPath = params.ref.path.slice(annoName.length)
    const attrField = getFieldFromPath(annoType, annoPath.split(' '))
    return (attrField) ? attrValueSuggestion(attrField, attrField.type) : []
  }
  if (annoType) {
    return attrValueSuggestion(annoType, annoType)
  }
  return []
}


/**
 * Returns a list of all of the types that were defined in the system
 * and whos adapter matches the context allowed adapters.
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
