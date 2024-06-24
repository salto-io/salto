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
import {
  TypeElement,
  Field,
  isObjectType,
  isInstanceElement,
  isPrimitiveType,
  isField,
  PrimitiveTypes,
  BuiltinTypes,
  Value,
  getField,
  getFieldNames,
  getFieldType,
  ElemID,
  isListType,
  getRestriction,
  isMapType,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { parser } from '@salto-io/parser'
import { resolvePath, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { ContextReference } from '../context'

const { awu } = collections.asynciterable
const { dumpElemID } = parser
type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

interface InsertText {
  label: string
  insertText: string
  filterText?: string
}
type Suggestion = string | InsertText
export type Suggestions = ThenableIterable<Suggestion>
type RefPartResolver = () => Promise<ThenableIterable<string>>
interface SuggestionsParams {
  elements: ReadOnlyElementsSource
  ref?: ContextReference
  tokens: string[]
}
export type SuggestionsResolver = (params: SuggestionsParams) => Suggestions | Promise<Suggestions>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isInsertText = (value: any): value is InsertText =>
  value.label !== undefined && value.insertText !== undefined

const getRefPathWithAttr = (attrName: string, ref: ContextReference): string[] =>
  _.last(ref.path) !== attrName && !ref.isList ? [...ref.path, attrName] : ref.path

const getRestrictionValues = (
  annotatingElem: TypeElement | Field,
  valueType: TypeElement,
): ReadonlyArray<Value> | undefined => getRestriction(annotatingElem).values ?? getRestriction(valueType).values

const getAllInstances = (elemIDs: AsyncIterable<ElemID>, refID: ElemID): ThenableIterable<string> =>
  awu(elemIDs)
    .filter(e => e.idType === 'instance')
    .filter(e => e.adapter === refID.adapter)
    .filter(e => e.typeName === refID.typeName)
    .map(e => e.name)

const getAllTypes = (elemIDs: AsyncIterable<ElemID>, adapter?: string): ThenableIterable<string> =>
  awu(elemIDs)
    .filter(e => e.idType === 'type' && (adapter === undefined || e.adapter === adapter))
    .map(dumpElemID)
// .filter(e => !adapter || e.elemID.adapter === adapter)
// .map(e => dumpElemID(e))

const getAdapterNames = (elemIDs: AsyncIterable<ElemID>): ThenableIterable<string> => {
  const adapters = new Set()
  return awu(elemIDs)
    .filter(e => {
      if (!adapters.has(e.adapter)) {
        adapters.add(e.adapter)
        return true
      }
      return false
    })
    .map(e => e.adapter)
}

const refNameSuggestions = async (
  elements: ReadOnlyElementsSource,
  refElemID: ElemID,
): Promise<ThenableIterable<string>> => {
  const baseID = new ElemID(refElemID.adapter, refElemID.typeName)
  const baseElement = await elements.get(baseID)
  if (!baseElement) return []

  switch (refElemID.idType) {
    case 'annotation':
      return _.keys(baseElement.annotationRefTypes)
    case 'attr':
      return _.keys(baseElement.annotations)
    case 'field':
      return isObjectType(baseElement) ? _.keys(baseElement.fields) : []
    case 'instance':
      return getAllInstances(await elements.list(), baseID)
    default:
      return []
  }
}

const refValueSuggestions = async (
  elements: ReadOnlyElementsSource,
  refElemID: ElemID,
): Promise<ThenableIterable<string>> => {
  const { parent } = refElemID.createTopLevelParentID()
  const parentElement = await elements.get(parent)
  if (_.isUndefined(parentElement)) return []
  const refValue = resolvePath(parentElement, refElemID)
  if (isField(refValue)) {
    return _.keys(refValue.annotations)
  }
  if (isInstanceElement(refValue)) {
    return _.keys(refValue.value).concat(_.keys(refValue.annotations))
  }
  if (_.isPlainObject(refValue)) {
    return _.keys(refValue)
  }
  if (_.isArray(refValue)) {
    return _.range(0, refValue.length).map(_.toString)
  }

  return []
}

const referenceSuggestions = async (elements: ReadOnlyElementsSource, valueToken: string): Promise<Suggestions> => {
  // Reference suggestions creates a lot of 'noise' so we will avoid returning anything
  // unless the user has already started writing the reference
  if (_.isEmpty(valueToken)) return []
  // This means we are not defining a reference
  const unquotedMatch = valueToken.match(/".*\$\{\s*([^}]*$)/)
  if (!unquotedMatch && (valueToken.includes('"') || valueToken.includes("'"))) return []
  const match = unquotedMatch ? unquotedMatch[1] : valueToken
  const refParts = match.split(ElemID.NAMESPACE_SEPARATOR).slice(0, -1)
  const refPartIndex = refParts.length
  // try & catch here as we must consider the possibility of an illegal elemID here.
  try {
    const refElemID = ElemID.fromFullName(refParts.join(ElemID.NAMESPACE_SEPARATOR))
    const refPartsResolvers: RefPartResolver[] = [
      async () => getAdapterNames(await elements.list()),
      async () =>
        awu(getAllTypes(await elements.list(), refElemID.adapter)).map(n => n.substring(refElemID.adapter.length + 1)),
      async () => awu(['instance', 'attr', 'field']),
      async () => refNameSuggestions(elements, refElemID),
      async () => refValueSuggestions(elements, refElemID),
    ]
    const refPartSuggestions =
      refPartIndex >= refPartsResolvers.length
        ? await refPartsResolvers[refPartsResolvers.length - 1]()
        : await refPartsResolvers[refPartIndex]()
    return awu(refPartSuggestions).map(sug => ({
      label: sug,
      insertText: [...refParts, sug].join(ElemID.NAMESPACE_SEPARATOR),
      filterText: [...refParts, sug].join(ElemID.NAMESPACE_SEPARATOR),
    }))
  } catch (e) {
    return []
  }
}

export const valueSuggestions = async (
  attrName: string,
  annotatingElem: TypeElement | Field,
  valueType: TypeElement,
  valueToken: string,
  elementsSource: ReadOnlyElementsSource,
): Promise<Suggestions> => {
  // If the annotating element is a list and we are not in a list content
  // we need to created one
  if (!_.isEmpty(valueToken)) return []

  if (isListType(valueType) && attrName) {
    return [{ label: '[]', insertText: '[$0]' }]
  }
  if (isMapType(valueType) && attrName) {
    return [{ label: '{}', insertText: '{$0}' }]
  }
  // Now that we know we are in the actual value - lets use it!
  const restrictionValues = getRestrictionValues(annotatingElem, valueType)
  if (restrictionValues) {
    return restrictionValues.map(v => safeJsonStringify(v))
  }
  const realValueType = isListType(valueType) ? await valueType.getInnerType(elementsSource) : valueType
  if (isListType(realValueType)) {
    return [{ label: '[]', insertText: '[$0]' }]
  }
  if (isObjectType(realValueType) || isMapType(realValueType)) {
    return [{ label: '{}', insertText: '{$0}' }]
  }
  if (isPrimitiveType(realValueType) && realValueType.primitive === PrimitiveTypes.STRING) {
    return [{ label: '""', insertText: '"$0"' }]
  }
  if (isPrimitiveType(realValueType) && realValueType.primitive === PrimitiveTypes.BOOLEAN) {
    return ['true', 'false']
  }
  return []
}

export const fieldSuggestions = async (params: SuggestionsParams): Promise<Suggestions> => {
  if (!(params.ref && isInstanceElement(params.ref.element))) return []
  const r = await getFieldNames(await params.ref.element.getType(params.elements), params.ref.path, params.elements)
  return r
}

export const fieldValueSuggestions = async (params: SuggestionsParams): Promise<Suggestions> => {
  if (!(params.ref && isInstanceElement(params.ref.element))) return []
  const attrName = params.tokens[0]
  const refPathWithAttr = getRefPathWithAttr(attrName, params.ref)
  const valueField = await getField(await params.ref.element.getType(params.elements), refPathWithAttr, params.elements)
  const valueFieldType = await getFieldType(
    await params.ref.element.getType(params.elements),
    refPathWithAttr,
    params.elements,
  )
  const valueToken = _.last(params.tokens) || ''
  return valueField && valueFieldType
    ? awu(await valueSuggestions(attrName, valueField, valueFieldType, valueToken, params.elements)).concat(
        await referenceSuggestions(params.elements, valueToken),
      )
    : referenceSuggestions(params.elements, valueToken)
}

export const annoSuggestions = async (params: SuggestionsParams): Promise<Suggestions> => {
  if (!params.ref) return []
  const refType = isField(params.ref.element) ? await params.ref.element.getType(params.elements) : params.ref.element
  if (_.isEmpty(params.ref.path)) {
    return _.keys(refType.annotationRefTypes)
  }
  const [annoName, ...annoPath] = params.ref.path
  const annoType = (await params.ref.element.getAnnotationTypes(params.elements))[annoName]
  if (annoName && isObjectType(annoType)) {
    return getFieldNames(annoType, annoPath, params.elements)
  }
  return []
}

export const annoValueSuggestions = async (params: SuggestionsParams): Promise<Suggestions> => {
  if (!params.ref) return []
  const attrName = params.tokens[0]
  const refPathWithAttr = getRefPathWithAttr(attrName, params.ref)
  const [annoName, ...refPath] = refPathWithAttr

  const annoType = isField(params.ref.element)
    ? (await (await params.ref.element.getType(params.elements)).getAnnotationTypes(params.elements))[annoName]
    : (await params.ref.element.getAnnotationTypes(params.elements))[annoName]

  const valueToken = _.last(params.tokens) || ''
  if (annoType && !_.isEmpty(refPath)) {
    const attrField = await getField(annoType, refPath, params.elements)
    const attrFieldType = await getFieldType(annoType, refPath, params.elements)
    return attrField && attrFieldType
      ? awu(await valueSuggestions(annoName, attrField, attrFieldType, valueToken, params.elements)).concat(
          await referenceSuggestions(params.elements, valueToken),
        )
      : referenceSuggestions(params.elements, valueToken)
  }
  return annoType
    ? awu(await valueSuggestions(annoName, annoType, annoType, valueToken, params.elements)).concat(
        await referenceSuggestions(params.elements, valueToken),
      )
    : referenceSuggestions(params.elements, valueToken)
}

/**
 * Returns a list of all of the types that were defined in the system
 * and who's adapter matches the context allowed adapters.
 */
export const typesSuggestions = async (params: SuggestionsParams): Promise<Suggestions> => {
  const contextAdapter = params.ref && params.ref.element.elemID.adapter
  const elements = params.elements || [] // may be undefined
  return awu(_.values(BuiltinTypes).map(e => e.elemID.getFullName())).concat(
    getAllTypes(await elements.list(), contextAdapter),
  )
}

export const typeBodySuggestions = async (params: SuggestionsParams): Promise<Suggestions> =>
  awu(await annoSuggestions(params)).concat(await typesSuggestions(params))
/**
 * Returns a list of all possible primitives in the inheritance section
 */
export const inheritanceSuggestions = (): Suggestions => awu(['string', 'number', 'boolean'])

/**
 * Returns all known keyword - which are 'type' for type def, and defined types
 * if we are defining an instance
 */
export const keywordSuggestions = async (params: SuggestionsParams): Promise<Suggestions> =>
  awu(['type' as Suggestion]).concat(await typesSuggestions(params))

export const eqSuggestions = (): Suggestions => ['=']

export const isSuggestions = (): Suggestions => ['is']

export const instanceSuggestions = async (params: SuggestionsParams): Promise<Suggestions> => {
  const elemID = ElemID.fromFullName(params.tokens[0])
  return getAllInstances(await params.elements.list(), elemID)
}
