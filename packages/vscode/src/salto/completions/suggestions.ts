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
import _ from 'lodash'
import { TypeElement, Field, isObjectType, isInstanceElement, isPrimitiveType,
  isField, PrimitiveTypes, BuiltinTypes, isType, Value, getField,
  getFieldNames, getFieldType, getAnnotationKey, ElemID, Element,
  CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { dumpElemID, parseElemID } from '@salto-io/core'
import { resolvePath } from '@salto-io/adapter-utils'
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

const getRestrictionValues = (annotatingElem: TypeElement|Field, valueType: TypeElement):
Value[]|undefined =>
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

const refNameSuggestions = (
  elements: readonly Element[],
  refElemID: ElemID,
): Suggestions => {
  const baseID = new ElemID(refElemID.adapter, refElemID.typeName)
  const baseElement = elements.find(e => e.elemID.getFullName() === baseID.getFullName())
  if (!baseElement) return []

  switch (refElemID.idType) {
    case 'annotation':
      return isType(baseElement) ? _.keys(baseElement.annotationTypes) : []
    case 'attr':
      return isType(baseElement) ? _.keys(baseElement.annotations) : []
    case 'field':
      return isObjectType(baseElement) ? _.keys(baseElement.fields) : []
    case 'instance':
      return getAllInstances(elements, baseID.adapter, baseID.getFullName())
    default:
      return []
  }
}

const refValueSuggestions = (
  elements: readonly Element[],
  refElemID: ElemID,
): Suggestions => {
  const { parent } = refElemID.createTopLevelParentID()
  const parentElement = elements.find(
    e => e.elemID.getFullName() === parent.getFullName()
  )
  if (_.isUndefined(parentElement)) return []
  const refValue = resolvePath(parentElement, refElemID)
  if (isField(refValue)) {
    return _.keys(refValue.annotations)
  }
  if (isInstanceElement(refValue)) {
    return _.keys(refValue.value)
  }
  if (_.isPlainObject(refValue)) {
    return _.keys(refValue)
  }
  if (_.isArray(refValue)) {
    return _.range(0, refValue.length).map(_.toString)
  }

  return []
}

const referenceSuggestions = (
  elements: ReadonlyArray<Element>,
  valueToken: string
): Suggestions => {
  // This means we are not defining a reference
  const unquotedMatch = valueToken.match(/".*\$\{\s*([^}]*$)/)
  if (!unquotedMatch && (valueToken.includes('"') || valueToken.includes("'"))) return []
  const match = unquotedMatch ? unquotedMatch[1] : valueToken
  const refParts = match.split(ElemID.NAMESPACE_SEPARATOR)
    .slice(0, -1)
  const refPartIndex = refParts.length

  // try & catch here as we must consider the possibility of an illegal elemID here.
  try {
    const refElemID = ElemID.fromFullName(refParts.join(ElemID.NAMESPACE_SEPARATOR))

    const refPartsResolvers = [
      () => getAdapterNames(elements),
      () => getAllTypes(elements || [], refElemID.adapter)
        .map(n => n.substring(refElemID.adapter.length + 1)),
      () => ['instance', 'attr', 'field'],
      () => refNameSuggestions(elements, refElemID),
      () => refValueSuggestions(elements, refElemID),
    ]

    return refPartIndex >= refPartsResolvers.length
      ? refPartsResolvers[refPartsResolvers.length - 1]()
      : refPartsResolvers[refPartIndex]()
  } catch (e) {
    return []
  }
}

export const valueSuggestions = (
  attrName: string,
  annotatingElem: TypeElement|Field,
  valueType: TypeElement,
  valueToken: string
): Suggestions => {
  // If the annotating element is a list and we are not in a list content
  // we need to created one

  if (!_.isEmpty(valueToken)) return []

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
      ...valueSuggestions(attrName, valueField, valueField.type, valueToken),
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
        ...valueSuggestions(annoName, attrField, attrField.type, valueToken),
        ...referenceSuggestions(params.elements, valueToken),
      ]
      : referenceSuggestions(params.elements, valueToken)
  }
  return (annoType)
    ? [
      ...valueSuggestions(annoName, annoType, annoType, valueToken),
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
