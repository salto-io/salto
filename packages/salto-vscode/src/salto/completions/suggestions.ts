import _ from 'lodash'
import { Type, Field, isObjectType, isInstanceElement, isPrimitiveType,
  isField, PrimitiveTypes, BuiltinTypes, isType, Value, getField,
  getFieldNames, getFieldType, getAnnotationKey, ElemID, Element,
  Values, CORE_ANNOTATIONS } from 'adapter-api'
import { dumpElemID, parseElemID } from 'salto'
import { ContextReference } from '../context'

interface InsertText {
  label: string
  insertText: string
  filterText?: string
}
type Suggestion = string|InsertText
export type Suggestions = Suggestion[]

interface SuggestionsParams {
  elements: ReadonlyArray<Element>
  ref?: ContextReference
  tokens: string[]
}
export type SuggestionsResolver = (params: SuggestionsParams) => Suggestions

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isInsertText = (value: any): value is InsertText => (
  value.label !== undefined && value.insertText !== undefined
)

const getRestrictionValues = (annotatingElem: Type|Field, valueType: Type): Value[]|undefined =>
  annotatingElem.annotations[CORE_ANNOTATIONS.VALUES]
  || valueType.annotations[CORE_ANNOTATIONS.VALUES]

const getAllInstances = (
  elements: ReadonlyArray<Element>,
  adapter?: string,
  typeName? : string
): string[] => elements
  .filter(isInstanceElement)
  .filter(e => !adapter || e.elemID.adapter === adapter)
  .filter(e => !typeName || e.type.elemID.getFullName() === typeName)
  .map(e => e.elemID.name)

const getAllTypes = (
  elements: ReadonlyArray<Element>,
  adapter?: string
): string[] => elements
  .filter(isType)
  .filter(e => !adapter || e.elemID.adapter === adapter)
  .map(e => dumpElemID(e))

const getAdapterNames = (
  elements: ReadonlyArray<Element>
): string[] => _(elements).map(e => e.elemID.adapter).uniq().value()

const getValuesSuggestions = (values: Values, path: string[]): string[] => {
  const relevantPath = path.slice(0, path.length - 1)
  const target = _.isEmpty(relevantPath) ? values : _.get(values, relevantPath)
  return _.isPlainObject(target) ? _.keys(target) : []
}

const getElementReferenceSuggestions = (
  elements: readonly Element[],
  matchElement: Element,
  path: string[]
): string[] => {
  if (isInstanceElement(matchElement)) {
    return getValuesSuggestions(matchElement.value, path)
  }
  if (isObjectType(matchElement) && path.length > 0) {
    const [pathType, ...restOfPath] = path
    if (pathType === 'instance' && _.isEmpty(restOfPath)) {
      return getAllInstances(
        elements,
        matchElement.elemID.adapter,
        matchElement.elemID.getFullName()
      )
    }
    if (pathType === 'field' && restOfPath.length === 1) {
      return _.keys(matchElement.fields)
    }
    if (pathType === 'field') {
      const field = matchElement.fields[restOfPath[0]]
      return field ? getValuesSuggestions(field.annotations, restOfPath.slice(1)) : []
    }
    if (pathType === 'attr') {
      return getValuesSuggestions(matchElement.annotations, restOfPath)
    }
  }
  return ['instance', 'attr', 'field']
}

const referenceSuggestions = (
  elements: ReadonlyArray<Element>,
  valueToken: string
): Suggestions => {
  // This means we are not defining a reference
  const unquotedMatch = valueToken.match(/".*\$\{\s*([^}]*$)/)
  if (!unquotedMatch && (valueToken.includes('"') || valueToken.includes("'"))) return []
  const match = unquotedMatch ? unquotedMatch[1] : valueToken
  const [adapter, ...elemIDParts] = match.split(ElemID.NAMESPACE_SEPARATOR)
  // We still didn't define the type -> we are still defining the adapter
  if (_.isEmpty(elemIDParts)) {
    return getAdapterNames(elements || [])
  }

  if (elemIDParts.length === 1) {
    return getAllTypes(elements || [], adapter)
      .map(n => n.substring(adapter.length + 1))
  }

  const elemID = new ElemID(adapter, ...elemIDParts)
  const matchElement = _(elements)
    .filter(e => elemID.getFullName().indexOf(e.elemID.getFullName()) === 0)
    .sortBy(e => e.elemID.getFullName().length)
    .last()
  if (matchElement) {
    const path = elemID.getFullName()
      .slice(matchElement.elemID.getFullName().length + 1)
      .split(ElemID.NAMESPACE_SEPARATOR)
    return getElementReferenceSuggestions(elements, matchElement, path)
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
    ? getFieldType(params.ref.element.type, refPath.split(ElemID.NAMESPACE_SEPARATOR))
    : params.ref.element.type

  const valueField = (attrName && isObjectType(refType))
    ? refType.fields[attrName]
    : getField(params.ref.element.type, refPath.split(ElemID.NAMESPACE_SEPARATOR))

  const valueToken = _.last(params.tokens) || ''
  return (valueField)
    ? [
      ...valueSuggestions(attrName, valueField, valueField.type),
      ...referenceSuggestions(params.elements, valueToken),
    ]
    : referenceSuggestions(params.elements, valueToken)
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
    const attrField = getField(annoType, refPath.split(ElemID.NAMESPACE_SEPARATOR))
    return (attrField)
      ? [
        ...valueSuggestions(annoName, attrField, attrField.type),
        ...referenceSuggestions(params.elements, valueToken),
      ]
      : referenceSuggestions(params.elements, valueToken)
  }
  return (annoType)
    ? [
      ...valueSuggestions(annoName, annoType, annoType),
      ...referenceSuggestions(params.elements, valueToken),
    ]
    : referenceSuggestions(params.elements, valueToken)
}


/**
 * Returns a list of all of the types that were defined in the system
 * and who's adapter matches the context allowed adapters.
 */
export const typesSuggestions = (params: SuggestionsParams): Suggestions => {
  const contextAdapter = params.ref && params.ref.element.elemID.adapter
  const elements = params.elements || [] // may be undefined
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

export const eqSuggestions = (): Suggestions => ['=']

export const isSuggestions = (): Suggestions => ['is']

export const instanceSuggestions = (
  params: SuggestionsParams
): Suggestions => {
  const elemID = parseElemID(params.tokens[0])
  return getAllInstances(
    params.elements,
    elemID.adapter,
    elemID.getFullName()
  )
}
