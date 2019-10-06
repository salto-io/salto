import _ from 'lodash'
import {
  Type, Field, isObjectType, isInstanceElement, isPrimitiveType,
  isField, PrimitiveTypes, BuiltinTypes, isType, Value, getField,
  getFieldNames, getFieldType, getAnnotationKey, ElemID, Element,
  getSubElement,
} from 'adapter-api'

import { SaltoWorkspace } from '../workspace'
import { ContextReference } from '../context'

interface InsertText {
  label: string
  insertText: string
  filterText?: string
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

const getAllInstances = (
  elements: ReadonlyArray<Element>,
  adapter?: string
): string[] => elements
  .filter(isInstanceElement)
  .filter(e => !adapter || e.elemID.adapter === adapter)
  .map(e => e.elemID.getFullName())

const getAllTypes = (
  elements: ReadonlyArray<Element>,
  adapter?: string
): string[] => elements
  .filter(isType)
  .filter(e => !adapter || e.elemID.adapter === adapter)
  .map(e => e.elemID.getFullName())

const getTypeReferenceSuggestions = (
  baseElement: Type,
  path: string[]
): Suggestions => {
  const getSubElementFields = (elementPathBase: Type, elementPath: string[]): Suggestions => {
    const element = getSubElement(elementPathBase, elementPath)
    const elementType = isField(element) ? element.type : element
    return (isObjectType(elementType))
      ? _.keys(elementType.fields)
      : []
  }

  const [firstPathPart, ...restOfPath] = path
  if (!firstPathPart) {
    return [
      ..._.keys(baseElement.annotationTypes),
      ...isObjectType(baseElement) ? _.keys(baseElement.fields) : [],
    ]
  }

  // Here is where it gets tricky - the first token can be an annotation value OR a field
  const annoType = baseElement.annotationTypes[firstPathPart]
  const field = isObjectType(baseElement) ? baseElement.fields[firstPathPart] : undefined
  const fieldType = field && field.type
  if (!restOfPath[0]) {
    return [
      ...annoType ? _.keys(annoType.annotationTypes) : [],
      ...isObjectType(annoType) ? _.keys(annoType.fields) : [],
      ...fieldType ? _.keys(fieldType.annotationTypes) : [],
      ...isObjectType(fieldType) ? _.keys(fieldType.fields) : [],
    ]
  }

  // But the rest can only return fields (since we treat complex annotation like instances)
  return [
    ...annoType ? getSubElementFields(annoType, restOfPath) : [],
    ...fieldType ? getSubElementFields(fieldType, restOfPath) : [],
  ]
}

const getAdapterNames = (
  elements: ReadonlyArray<Element>
): string[] => _(elements).map(e => e.elemID.adapter).uniq().value()

const referenceSuggestions = (
  workspace: SaltoWorkspace,
  valueToken: string
): Suggestions => {
  // This means we are not defining a reference
  const unquotedMatch = valueToken.match(/".*\$\{\s*([^}]*$)/)
  if (!unquotedMatch && (valueToken.includes('"') || valueToken.includes("'"))) return []
  const match = unquotedMatch ? unquotedMatch[1] : valueToken
  const [base, ...path] = match.split('.')
  const sepIndex = base.indexOf(ElemID.NAMESPACE_SEPERATOR)
  const adapter = (sepIndex >= 0) ? base.substring(0, sepIndex) : base
  const baseElementName = (sepIndex >= 0) ? base.substring(sepIndex) : ''
  // We are defining the base element
  if (!baseElementName) {
    return getAdapterNames(workspace.elements || [])
  }
  if (path.length === 0) {
    return [
      ...getAllInstances(workspace.elements || [], adapter),
      ...getAllTypes(workspace.elements || [], adapter),
    ].map(name => ({
      label: name.substring(name.indexOf(ElemID.NAMESPACE_SEPERATOR) + 1),
      insertText: name,
      filterText: name,
    }))
  }

  const baseElement = (workspace.elements || [])
    .filter(e => e.elemID.getFullName() === base)[0]

  // If we didn't find the base element we can't continue
  if (!baseElement) return []

  // If base is instance, we just need to get the field by the path and return its
  // fields
  if (isInstanceElement(baseElement)) {
    return getFieldNames(baseElement.type, path.join(ElemID.NAMESPACE_SEPERATOR))
  }

  if (isType(baseElement)) {
    return getTypeReferenceSuggestions(baseElement, path)
  }

  return []
}

export const valueSuggestions = (
  attrName: string,
  annotatingElem: Type|Field,
  valueType: Type
): Suggestions => {
  // If the annotating element is a list and we are not in a list content
  // we need to created one
  if (isField(annotatingElem) && annotatingElem.isList && attrName) {
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
  const refPath = (attrName)
    ? params.ref.path.replace(new RegExp(`${attrName}$`), '')
    : params.ref.path
  const refType = (refPath)
    ? getFieldType(params.ref.element.type, refPath.split(ElemID.NAMESPACE_SEPERATOR))
    : params.ref.element.type

  const valueField = (attrName && isObjectType(refType))
    ? refType.fields[attrName]
    : getField(params.ref.element.type, refPath.split(ElemID.NAMESPACE_SEPERATOR))

  const valueToken = _.last(params.tokens) || ''
  return (valueField)
    ? [
      ...valueSuggestions(attrName, valueField, valueField.type),
      ...referenceSuggestions(params.workspace, valueToken),
    ]
    : referenceSuggestions(params.workspace, valueToken)
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
  const refPath = (annoName)
    ? params.ref.path.replace(new RegExp(`${annoName}$`), '')
    : params.ref.path
  const valueToken = _.last(params.tokens) || ''
  if (annoType && refPath) {
    const attrField = getField(annoType, refPath.split('_'))
    return (attrField)
      ? [
        ...valueSuggestions(annoName, attrField, attrField.type),
        ...referenceSuggestions(params.workspace, valueToken),
      ]
      : referenceSuggestions(params.workspace, valueToken)
  }
  return (annoType)
    ? [
      ...valueSuggestions(annoName, annoType, annoType),
      ...referenceSuggestions(params.workspace, valueToken),
    ]
    : referenceSuggestions(params.workspace, valueToken)
}


/**
 * Returns a list of all of the types that were defined in the system
 * and who's adapter matches the context allowed adapters.
 */
export const typesSuggestions = (params: SuggestionsParams): Suggestions => {
  const contextAdapter = params.ref && params.ref.element.elemID.adapter
  const elements = params.workspace.elements || [] // may be undefined
  const typeNames = [
    ..._.values(BuiltinTypes).map(e => e.elemID.getFullName()),
    ...getAllTypes(elements, contextAdapter),
  ]

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
): Suggestions => getAllInstances(params.workspace.elements || [])
