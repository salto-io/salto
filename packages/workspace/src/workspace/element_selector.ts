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
import { ElemID, ElemIDTypes, Value, ElemIDTopLevelTypes, isType, isObjectType, isInstanceElement,
  isElement } from '@salto-io/adapter-api'

export type ElementSelector = {
  adapterSelector: RegExp
  typeNameSelector: RegExp
  idTypeSelector: string
  nameSelectors?: RegExp[]
  origin: string
}

export type ElementIDToValue = {
  elemID: ElemID
  element: Value
}

type ElementIDToValueResult = {
  elementIdToValue: ElementIDToValue[]
  matches: Record<string, boolean>
}

type ElementIDContainer = {
  elemID: ElemID
}

const testNames = (nameArray: readonly string[], nameSelectors?: RegExp[]): boolean =>
  !nameSelectors
  || (nameArray.length === nameSelectors.length
    && nameSelectors.every((regex, i) => regex.test(nameArray[i])))

const match = (elemId: ElemID, selector: ElementSelector): boolean =>
  selector.adapterSelector.test(elemId.adapter)
  && selector.typeNameSelector.test(elemId.typeName)
  && (selector.idTypeSelector === elemId.idType)
  && testNames(elemId.getFullNameParts().slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS),
    selector.nameSelectors)

const createRegex = (selector: string): RegExp => new RegExp(`^${selector.replace(/\*/g, '\\w*')}$`)

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function isElementContainer(value: any): value is ElementIDContainer {
  return value && value.elemID && value.elemID instanceof ElemID
}

const getParentFromSelector = (selector: ElementSelector, depth: number): string => {
  if (ElemIDTopLevelTypes.includes(selector.idTypeSelector)) {
    return selector
      .origin.split(ElemID.NAMESPACE_SEPARATOR).slice(0,
        ElemID.NUM_ELEM_ID_NON_NAME_PARTS + depth).join(ElemID.NAMESPACE_SEPARATOR)
  }
  if (depth === 1) {
    // In this case the parent would be just the adapter and type.
    return selector.origin.split(ElemID.NAMESPACE_SEPARATOR)
      .slice(0, 2).join(ElemID.NAMESPACE_SEPARATOR)
  }
  return selector.origin.split(ElemID.NAMESPACE_SEPARATOR).slice(0,
    ElemID.NUM_ELEM_ID_NON_NAME_PARTS + depth - 1).join(ElemID.NAMESPACE_SEPARATOR)
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
    idTypeSelector: idTypeSelector ?? ElemID.getDefaultIdType(adapterSelector),
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

const filterOutChildSelectors = (selectors: ElementSelector[],
  currentLevelElementsSelected: ElementIDToValue[]): ElementSelector[] =>
  selectors.filter(selector => _.isEmpty(selectElementsBySelectors(currentLevelElementsSelected,
    [selector], false).elements))

const createParentSelectors = (subElementSelectors: ElementSelector[],
  currentLevelElementsSelected: ElementIDToValue[], compact: boolean,
  depth: number): ElementSelector[] => {
  const selectors = subElementSelectors
    .map(selector => createElementSelector(getParentFromSelector(selector, depth)))
  return compact ? filterOutChildSelectors(selectors, currentLevelElementsSelected) : selectors
}

const isTopLevelSelector = (selector: ElementSelector, depth: number): boolean => {
  if (ElemIDTopLevelTypes.includes(selector.idTypeSelector)) {
    return (!selector.nameSelectors || selector.nameSelectors.length <= depth)
  }
  return (!selector.nameSelectors || (selector.nameSelectors.length <= depth - 1))
}

const getPossiblePathsFromParent = (parent: Element): string[] => {
  const paths = ['annotations']
  if (isType(parent)) {
    paths.push('annotationRefTypes')
  }
  if (isObjectType(parent)) {
    paths.push('fields')
  }
  if (isInstanceElement(parent)) {
    paths.push('value')
  }
  return paths
}

const pathNameToIdType = (path: string): string => ((path === 'annotations') ? 'annotation.' : '')

const isNestedElement = (parentElement: ElementIDToValue): boolean =>
  parentElement.elemID.getFullNameParts().length > ElemID.NUM_ELEM_ID_NON_NAME_PARTS

const createPathToPropertyMapping = (parentElement: ElementIDToValue, path: string):
[string, unknown][] => ((parentElement.element[path]) ? Object.entries(parentElement.element[path])
  .map((entry): [string, unknown] => [`${pathNameToIdType(path)}${entry[0]}`, entry[1]]) : [])

const subElementIDToValue = (subElement: [string, unknown], parentElement: ElementIDToValue):
  { elemID: ElemID; element: unknown } => ({
  elemID: isElement(subElement[1]) ? subElement[1].elemID
    : parentElement.elemID.createNestedID(...subElement[0].split('.')),
  element: subElement[1],
})

const getSubElements = async (parentElement: ElementIDToValue): Promise<ElementIDToValue[]> =>
  getPossiblePathsFromParent(parentElement.element)
    .flatMap(path => createPathToPropertyMapping(parentElement, path))
    .concat(isNestedElement(parentElement) ? Object.entries(parentElement.element) : [])
    .map(subElement => subElementIDToValue(subElement, parentElement))

const removeChildElements = (currentLevelElementsSelected:
  ElementIDToValue[]): ElementIDToValue[] =>
  currentLevelElementsSelected.filter(element => !currentLevelElementsSelected
    .some(possibleParent => possibleParent.elemID.isParentOf(element.elemID)))

const selectElementsForDepth = (selectors: ElementSelector[], elements: ElementIDToValue[],
  compact: boolean, depth: number): {
    subElementSelectors: ElementSelector[]
    matches: Record<string, boolean>
    currentLevelElementsSelected: ElementIDToValue[]
  } => {
  const [topLevelSelectors, subElementSelectors] = _.partition(selectors, selector =>
    isTopLevelSelector(selector, depth))
  const { elements: currentLevelElementsSelected, matches } = topLevelSelectors.length > 0
    ? selectElementsBySelectors(elements, topLevelSelectors, false)
    : { elements: [], matches: {} }
  return {
    subElementSelectors,
    matches,
    currentLevelElementsSelected:
      compact ? removeChildElements(currentLevelElementsSelected) : currentLevelElementsSelected,
  }
}

const getElementIdsFromSelectorsRecursivelyInner = async (
  selectors: ElementSelector[], elements: ElementIDToValue[], compact = false, depth = 1
): Promise<ElementIDToValueResult> => {
  const { subElementSelectors, matches,
    currentLevelElementsSelected } = selectElementsForDepth(selectors, elements, compact, depth)
  if (_.isEmpty(subElementSelectors)) {
    return { elementIdToValue: currentLevelElementsSelected, matches }
  }
  const subElementParentSelectors = createParentSelectors(subElementSelectors,
    currentLevelElementsSelected, compact, depth)
  if (subElementParentSelectors.length === 0) {
    return { elementIdToValue: currentLevelElementsSelected, matches }
  }
  const { elements: possibleParentElements } = selectElementsBySelectors(elements,
    subElementParentSelectors, false)
  if (possibleParentElements.length === 0) {
    return { elementIdToValue: currentLevelElementsSelected, matches }
  }
  const possibleSubElements = (await Promise.all(possibleParentElements.map(getSubElements))).flat()
  const { elementIdToValue: lowerLevelElements,
    matches: lowerLevelMatches } = await getElementIdsFromSelectorsRecursivelyInner(
    subElementSelectors, possibleSubElements, compact, depth + 1
  )
  return { elementIdToValue: currentLevelElementsSelected.concat(lowerLevelElements),
    matches: Object.assign(matches, lowerLevelMatches) }
}

export const getElementIdsFromSelectorsRecursively = async (
  selectors: ElementSelector[], elements: ElementIDToValue[],
  compact = false): Promise<ElementIDToValue[]> => {
  const { elementIdToValue: results,
    matches } = await getElementIdsFromSelectorsRecursivelyInner(selectors, elements, compact)
  validateSelectorsMatches(selectors, matches)
  return results
}
