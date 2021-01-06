/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, ElemIDTypes, Value, ElemIDType } from '@salto-io/adapter-api'
import { TransformFunc, transformElement } from '@salto-io/adapter-utils'

export type ElementSelector = {
  adapterSelector: RegExp
  typeNameSelector: RegExp
  idTypeSelector: ElemIDType
  nameSelectors?: RegExp[]
  origin: string
}

export type ElementIDToValue = {
  elemID: ElemID
  element: Value
}

type ElementIDContainer = {
  elemID: ElemID
}

const testNames = (nameArray: readonly string[], nameSelectors?: RegExp[]): boolean =>
  (nameSelectors ? (nameArray.length === nameSelectors.length
    && nameSelectors.every((regex, i) => regex.test(nameArray[i])))
    : nameArray.length === 0)

const match = (elemId: ElemID, selector: ElementSelector): boolean =>
  selector.adapterSelector.test(elemId.adapter)
  && selector.typeNameSelector.test(elemId.typeName)
  && (selector.idTypeSelector === elemId.idType)
  && testNames(elemId.getFullNameParts().slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS),
    selector.nameSelectors)

const createRegex = (selector: string): RegExp => new RegExp(`^${selector.replace(/\*/g, '[^\\.]*')}$`)

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function isElementContainer(value: any): value is ElementIDContainer {
  return value && value.elemID && value.elemID instanceof ElemID
}

export const validateSelectorsMatches = (selectors: ElementSelector[],
  matches: Record<string, boolean>): void => {
  const invalidDeterminedMatchers = selectors.filter(selector => !selector.origin.includes('*') && !matches[selector.origin])
  if (invalidDeterminedMatchers.length > 0) {
    throw new Error(`The following salto ids were not found: ${invalidDeterminedMatchers.map(selector => selector.origin)}`)
  }
  if (selectors.every(selector => !matches[selector.origin])) {
    throw new Error(`No salto ids matched the provided selectors ${selectors.map(selector => selector.origin)}`)
  }
}

export const selectElementsBySelectors = <T extends ElementIDContainer | ElemID>
  (elementIds: Iterable<T>, selectors: ElementSelector[], validateSelectors = true):
    { elements: T[]; matches: Record<string, boolean> } => {
  const matches: Record<string, boolean> = { }
  if (selectors.length === 0) {
    return { elements: Array.from(elementIds), matches }
  }
  const elements = Array.from(elementIds).filter(obj => selectors.some(
    selector => {
      const result = match(isElementContainer(obj) ? obj.elemID : obj as ElemID, selector)
      matches[selector.origin] = matches[selector.origin] || result
      return result
    }
  ))
  if (validateSelectors) {
    validateSelectorsMatches(selectors, matches)
  }
  return { elements, matches }
}

const getIDType = (adapterSelector: string, idTypeSelector?: string): ElemIDType =>
  (idTypeSelector ? idTypeSelector as ElemIDType : ElemID
    .getDefaultIdType(adapterSelector))

export const createElementSelector = (selector: string): ElementSelector => {
  const [adapterSelector, typeNameSelector, idTypeSelector, ...nameSelectors] = selector
    .split(ElemID.NAMESPACE_SEPARATOR)
  if (!adapterSelector) {
    throw new Error(`Illegal element selector does not contain adapter expression: "${selector}"`)
  }
  if (!typeNameSelector) {
    throw new Error(`Illegal element selector does not contain type name: "${selector}"`)
  }
  if (idTypeSelector && !(ElemIDTypes.includes(idTypeSelector))) {
    throw new Error(`Illegal element selector includes illegal type name: "${idTypeSelector}". Full selector is: "${selector}"`)
  }
  return {
    adapterSelector: createRegex(adapterSelector),
    typeNameSelector: createRegex(typeNameSelector),
    idTypeSelector: getIDType(adapterSelector, idTypeSelector),
    origin: selector,
    nameSelectors: nameSelectors.length > 0 ? nameSelectors.map(createRegex) : undefined,
  }
}

const isValidSelector = (selector: string): boolean => {
  try {
    createElementSelector(selector)
    return true
  } catch (e) {
    return false
  }
}

export const createElementSelectors = (selectors: string[]):
  {validSelectors: ElementSelector[]; invalidSelectors: string[]} => {
  const [validSelectors, invalidSelectors] = _.partition(selectors, isValidSelector)
  const [wildcardSelectors, determinedSelectors] = _.partition(validSelectors, selector => selector.includes('*'))
  const orderedSelectors = determinedSelectors.concat(wildcardSelectors)
  return { validSelectors: orderedSelectors.map(createElementSelector), invalidSelectors }
}

const isTopLevelSelector = (selector: ElementSelector): boolean =>
  ElemID.fromFullName(selector.origin).isTopLevel()

const createTopLevelSelector = (selector: ElementSelector): ElementSelector => {
  if (ElemID.TOP_LEVEL_ID_TYPES_WITH_NAME.includes(selector.idTypeSelector)) {
    return {
      adapterSelector: selector.adapterSelector,
      idTypeSelector: selector.idTypeSelector,
      typeNameSelector: selector.typeNameSelector,
      nameSelectors: selector.nameSelectors?.slice(0, 1),
      origin: selector.origin.split(ElemID.NAMESPACE_SEPARATOR).slice(0,
        ElemID.NUM_ELEM_ID_NON_NAME_PARTS + 1).join(ElemID.NAMESPACE_SEPARATOR),
    }
  }
  const idType = isTopLevelSelector(selector) ? selector.idTypeSelector
    : ElemID.getDefaultIdType(selector.adapterSelector.source)
  return {
    adapterSelector: selector.adapterSelector,
    idTypeSelector: idType,
    typeNameSelector: selector.typeNameSelector,
    origin: [selector.adapterSelector.source, selector
      .typeNameSelector.source, idType].join(ElemID.NAMESPACE_SEPARATOR),
  }
}

const createSameDepthSelector = (selector: ElementSelector, elemID: ElemID): ElementSelector =>
  createElementSelector(selector.origin.split(ElemID.NAMESPACE_SEPARATOR).slice(0,
    elemID.getFullNameParts().length).join(ElemID.NAMESPACE_SEPARATOR))

const isElementPossiblyParentOfSearchedElement = (
  selectors: ElementSelector[], testId: ElemID
): boolean => (
  selectors.some(selector => match(testId, createSameDepthSelector(selector, testId)))
)

export const selectElementIdsByTraversal = (
  selectors: ElementSelector[],
  elements: ElementIDToValue[],
  compact = false,
  validateDeterminedSelectors = false,
): ElemID[] => {
  const [selectorsToDetermine, determinedSelectors] = validateDeterminedSelectors ? [selectors, []]
    : _.partition(selectors, selector => selector.origin.includes('*'))
  const determinedIds = determinedSelectors.map(selector => selector.origin)
  const ids = new Set(determinedIds)
  if (selectorsToDetermine.length === 0) {
    return [...ids].map(id => ElemID.fromFullName(id))
  }
  const [topLevelSelectors, subElementSelectors] = _.partition(selectorsToDetermine,
    isTopLevelSelector)
  if (topLevelSelectors.length !== 0) {
    const { elements: topLevelElements } = selectElementsBySelectors(elements,
      topLevelSelectors, false)
    topLevelElements.forEach(element => ids.add(element.elemID.getFullName()))
    if (subElementSelectors.length === 0) {
      return [...ids].map(id => ElemID.fromFullName(id))
    }
  }
  const possibleParentSelectors = subElementSelectors.map(createTopLevelSelector)
  const possibleParentElements = selectElementsBySelectors(elements, possibleParentSelectors,
    false).elements
  const stillRelevantElements = compact ? possibleParentElements
    .filter(id => !ids.has(id.elemID.getFullName())) : possibleParentElements
  if (stillRelevantElements.length === 0) {
    return [...ids].map(id => ElemID.fromFullName(id))
  }
  const selectFromSubElements: TransformFunc = ({ path, value }) => {
    if (path === undefined) {
      return undefined
    }
    const testId = path
    if (subElementSelectors.some(selector => match(testId, selector))) {
      ids.add(testId.getFullName())
      if (compact) {
        return undefined
      }
    }
    const stillRelevantSelectors = selectorsToDetermine.filter(selector => selector
      .origin.split(ElemID.NAMESPACE_SEPARATOR).length > testId.getFullNameParts().length)
    if (stillRelevantSelectors.length === 0) {
      return undefined
    }
    if (compact && determinedIds.includes(testId.getFullName())) {
      // This can occur if testId is one given as a determined id, so we don't search for it,
      // but because we just found it while searching, in compact scenario we need to return
      return undefined
    }
    if (isElementPossiblyParentOfSearchedElement(stillRelevantSelectors, testId)) {
      return value
    }
    return undefined
  }
  stillRelevantElements.forEach(elemContainer => transformElement({
    element: elemContainer.element, transformFunc: selectFromSubElements, runOnFields: true,
  }))
  return [...ids].map(id => ElemID.fromFullName(id))
}
