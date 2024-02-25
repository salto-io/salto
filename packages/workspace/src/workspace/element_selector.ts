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
import { ElemID, ElemIDTypes, Value, ElemIDType, isObjectType } from '@salto-io/adapter-api'
import { walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, promises } from '@salto-io/lowerdash'
import { ElementsSource } from './elements_source'
import { ReadOnlyRemoteMap } from './remote_map'

const { withLimitedConcurrency } = promises.array
const { asynciterable } = collections
const { awu } = asynciterable
const log = logger(module)

type FlatElementSelector = {
  adapterSelector: RegExp
  typeNameSelector: RegExp
  idTypeSelector: ElemIDType
  nameSelectors?: RegExp[]
  caseInsensitive?: boolean
  origin: string
}

export type ElementSelector = FlatElementSelector & {
  referencedBy?: FlatElementSelector
}

export type ElementIDToValue = {
  elemID: ElemID
  element: Value
}

type ElementIDContainer = {
  elemID: ElemID
}

// get the full name including handling for settings instances ('_config')
const getElemIDFullNameParts = (elemID: ElemID): string[] => {
  const fullNameParts = elemID.getFullNameParts()
  if (elemID.isTopLevel() && elemID.idType === 'instance' && elemID.name === ElemID.CONFIG_NAME) {
    return [...fullNameParts, elemID.name]
  }
  return fullNameParts
}

const testNames = (nameArray: readonly string[], nameSelectors: RegExp[], includeNested = false): boolean =>
  (nameArray.length === nameSelectors.length || (includeNested && nameArray.length > nameSelectors.length)) &&
  nameSelectors.every((regex, i) => regex.test(nameArray[i]))

const match = (elemId: ElemID, selector: ElementSelector, includeNested = false): boolean =>
  selector.adapterSelector.test(elemId.adapter) &&
  selector.typeNameSelector.test(elemId.typeName) &&
  (selector.idTypeSelector === elemId.idType ||
    (includeNested &&
      selector.idTypeSelector === 'type' &&
      elemId.createTopLevelParentID().parent.idType === 'type')) &&
  testNames(
    getElemIDFullNameParts(elemId).slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS),
    selector.nameSelectors ?? [],
    includeNested,
  )

const matchWithReferenceBy = async (
  elemId: ElemID,
  selector: ElementSelector,
  referenceSourcesIndex: ReadOnlyRemoteMap<ElemID[]>,
  includeNested = false,
): Promise<boolean> => {
  const { referencedBy } = selector
  return (
    match(elemId, selector, includeNested) &&
    (referencedBy === undefined ||
      (
        (await referenceSourcesIndex.get(
          (selector.idTypeSelector === 'field'
            ? elemId.createBaseID()
            : elemId.createTopLevelParentID()
          ).parent.getFullName(),
        )) ?? []
      ).some(id => match(id, referencedBy, true)))
  )
}

const createRegex = (selector: string, caseInSensitive: boolean): RegExp =>
  new RegExp(`^(${selector.replace(/\*/g, '[^\\.]*')})$`, caseInSensitive ? 'i' : undefined)

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function isElementContainer(value: any): value is ElementIDContainer {
  return value && value.elemID && value.elemID instanceof ElemID
}

const isWildcardSelector = (selector: string): boolean => selector.includes('*')

const hasReferencedBy = (selector: ElementSelector): boolean => selector.referencedBy !== undefined

export const validateSelectorsMatches = (selectors: ElementSelector[], matches: Record<string, boolean>): void => {
  const invalidDeterminedMatchers = selectors.filter(
    selector => !isWildcardSelector(selector.origin) && !matches[selector.origin],
  )
  if (invalidDeterminedMatchers.length > 0) {
    throw new Error(
      `The following salto ids were not found: ${invalidDeterminedMatchers.map(selector => selector.origin)}`,
    )
  }
  if (selectors.every(selector => !matches[selector.origin])) {
    throw new Error(`No salto ids matched the provided selectors ${selectors.map(selector => selector.origin)}`)
  }
}

// this function is a synchronous version for selectElementsBySelectors below that allows better performance
// for use cases where there is no need to get referenced elements.
export const selectElementsBySelectorsWithoutReferences = ({
  elementIds,
  selectors,
  includeNested = false,
}: {
  elementIds: ElemID[]
  selectors: ElementSelector[]
  includeNested?: boolean
}): ElemID[] => {
  if (selectors.length === 0) {
    return elementIds
  }
  return elementIds.filter(elementId => selectors.some(selector => match(elementId, selector, includeNested)))
}

export const selectElementsBySelectors = ({
  elementIds,
  selectors,
  referenceSourcesIndex,
  includeNested = false,
}: {
  elementIds: AsyncIterable<ElemID>
  selectors: ElementSelector[]
  referenceSourcesIndex: ReadOnlyRemoteMap<ElemID[]>
  includeNested?: boolean
}): AsyncIterable<ElemID> => {
  if (selectors.length === 0) {
    return elementIds
  }
  return awu(elementIds).filter(obj =>
    awu(selectors).some(selector =>
      matchWithReferenceBy(
        isElementContainer(obj) ? obj.elemID : (obj as ElemID),
        selector,
        referenceSourcesIndex,
        includeNested,
      ),
    ),
  )
}

const getIDType = (adapterSelector: string, idTypeSelector?: string): ElemIDType =>
  idTypeSelector ? (idTypeSelector.toLowerCase() as ElemIDType) : ElemID.getDefaultIdType(adapterSelector)

export const createElementSelector = (selector: string, caseInSensitive = false): ElementSelector => {
  const [adapterSelector, typeNameSelector, idTypeSelector, ...nameSelectors] = selector.split(
    ElemID.NAMESPACE_SEPARATOR,
  )
  if (!adapterSelector) {
    throw new Error(`Illegal element selector does not contain adapter expression: "${selector}"`)
  }
  if (!typeNameSelector) {
    throw new Error(`Illegal element selector does not contain type name: "${selector}"`)
  }
  if (idTypeSelector && !ElemIDTypes.includes(idTypeSelector)) {
    throw new Error(
      `Illegal element selector includes illegal type name: "${idTypeSelector}". Full selector is: "${selector}"`,
    )
  }
  try {
    ElemID.fromFullName(selector)
  } catch (e) {
    throw new Error(`Illegal element selector is not a valid element ID: "${selector}"`)
  }

  return {
    adapterSelector: createRegex(adapterSelector, caseInSensitive),
    typeNameSelector: createRegex(typeNameSelector, caseInSensitive),
    idTypeSelector: getIDType(adapterSelector, idTypeSelector),
    origin: selector,
    caseInsensitive: caseInSensitive,
    nameSelectors: nameSelectors.length > 0 ? nameSelectors.map(s => createRegex(s, caseInSensitive)) : undefined,
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

export const createElementSelectors = (
  selectors: string[],
  caseInSensitive = false,
): { validSelectors: ElementSelector[]; invalidSelectors: string[] } => {
  const [validSelectors, invalidSelectors] = _.partition(selectors, isValidSelector)
  const [wildcardSelectors, determinedSelectors] = _.partition(validSelectors, isWildcardSelector)
  const orderedSelectors = determinedSelectors.concat(wildcardSelectors)
  return {
    validSelectors: orderedSelectors.map(s => createElementSelector(s, caseInSensitive)),
    invalidSelectors,
  }
}

export const isTopLevelSelector = (selector: ElementSelector): boolean =>
  ElemID.fromFullName(selector.origin).isTopLevel()

export const createTopLevelSelector = (selector: ElementSelector): ElementSelector => {
  if (ElemID.TOP_LEVEL_ID_TYPES_WITH_NAME.includes(selector.idTypeSelector)) {
    return {
      adapterSelector: selector.adapterSelector,
      idTypeSelector: selector.idTypeSelector,
      typeNameSelector: selector.typeNameSelector,
      nameSelectors: selector.nameSelectors?.slice(0, 1),
      caseInsensitive: selector.caseInsensitive,
      origin: selector.origin
        .split(ElemID.NAMESPACE_SEPARATOR)
        .slice(0, ElemID.NUM_ELEM_ID_NON_NAME_PARTS + 1)
        .join(ElemID.NAMESPACE_SEPARATOR),
      referencedBy: selector.referencedBy,
    }
  }
  const idType = isTopLevelSelector(selector)
    ? selector.idTypeSelector
    : ElemID.getDefaultIdType(selector.adapterSelector.source)
  return {
    adapterSelector: selector.adapterSelector,
    idTypeSelector: idType,
    typeNameSelector: selector.typeNameSelector,
    caseInsensitive: selector.caseInsensitive,
    origin: [selector.adapterSelector.source, selector.typeNameSelector.source, idType].join(
      ElemID.NAMESPACE_SEPARATOR,
    ),
  }
}

const createSameDepthSelector = (selector: ElementSelector, elemID: ElemID): ElementSelector =>
  createElementSelector(
    selector.origin
      .split(ElemID.NAMESPACE_SEPARATOR)
      .slice(0, getElemIDFullNameParts(elemID).length)
      .join(ElemID.NAMESPACE_SEPARATOR),
    selector.caseInsensitive,
  )

const isElementPossiblyParentOfSearchedElement = (selectors: ElementSelector[], testId: ElemID): boolean =>
  selectors.some(selector => match(testId, createSameDepthSelector(selector, testId)))

const isBaseIdSelector = (selector: ElementSelector): boolean =>
  (selector.idTypeSelector === 'field' && (selector.nameSelectors ?? []).length === 1) || isTopLevelSelector(selector)

const validateSelector = (selector: ElementSelector): void => {
  if (hasReferencedBy(selector)) {
    if (!isBaseIdSelector(selector)) {
      throw new Error(
        `Unsupported selector: referencedBy is only supported for selector of base ids (types, fields or instances), received: ${selector.origin}`,
      )
    }
  }
}

const MAX_SUB_ELEMENT_SELECTORS_CONCURRENCY = 100

export const selectElementIdsByTraversal = async ({
  selectors,
  source,
  referenceSourcesIndex,
  compact = false,
}: {
  selectors: ElementSelector[]
  source: ElementsSource
  referenceSourcesIndex: ReadOnlyRemoteMap<ElemID[]>
  compact?: boolean
}): Promise<AsyncIterable<ElemID>> =>
  log.time(async () => {
    const determinedSelectors = selectors.filter(
      selector => !isWildcardSelector(selector.origin) && !hasReferencedBy(selector),
    )
    if (determinedSelectors.length === selectors.length) {
      return awu(determinedSelectors).map(selector => ElemID.fromFullName(selector.origin))
    }
    selectors.forEach(selector => validateSelector(selector))

    const [topLevelSelectors, subElementSelectors] = _.partition(selectors, isTopLevelSelector)

    const getTopLevelIDs = async (): Promise<ElemID[]> => {
      if (topLevelSelectors.length === 0) {
        return []
      }
      return awu(
        selectElementsBySelectors({
          elementIds: awu(await source.list()),
          selectors: topLevelSelectors,
          referenceSourcesIndex,
        }),
      ).toArray()
    }

    const topLevelIDs = await getTopLevelIDs()
    if (subElementSelectors.length === 0) {
      return awu(topLevelIDs)
    }
    const currentIds = new Set(topLevelIDs.map(id => id.getFullName()))

    const possibleParentSelectors = subElementSelectors.map(createTopLevelSelector)
    const possibleParentIDs = await awu(
      selectElementsBySelectors({
        elementIds: awu(await source.list()),
        selectors: possibleParentSelectors,
        referenceSourcesIndex,
      }),
    ).toArray()
    const stillRelevantIDs = compact
      ? possibleParentIDs.filter(id => !currentIds.has(id.getFullName()))
      : possibleParentIDs

    const [subSelectorsWithReferencedBy, subSelectorsWithoutReferencedBy] = _.partition(
      subElementSelectors,
      hasReferencedBy,
    )

    const subElementIDs = new Set<string>()
    const selectFromSubElements: WalkOnFunc = ({ path }) => {
      if (getElemIDFullNameParts(path).length <= 1) {
        return WALK_NEXT_STEP.RECURSE
      }

      if (subSelectorsWithoutReferencedBy.some(selector => match(path, selector))) {
        subElementIDs.add(path.getFullName())
        if (compact) {
          return WALK_NEXT_STEP.SKIP
        }
      }
      const stillRelevantSelectors = selectors.filter(
        selector => selector.origin.split(ElemID.NAMESPACE_SEPARATOR).length > getElemIDFullNameParts(path).length,
      )
      if (stillRelevantSelectors.length === 0) {
        return WALK_NEXT_STEP.SKIP
      }
      if (isElementPossiblyParentOfSearchedElement(stillRelevantSelectors, path)) {
        return WALK_NEXT_STEP.RECURSE
      }
      return WALK_NEXT_STEP.SKIP
    }
    const addSubElementIDs = async (elemID: ElemID): Promise<void> => {
      const element = await source.get(elemID)
      walkOnElement({
        element,
        func: selectFromSubElements,
      })
      if (isObjectType(element) && subSelectorsWithReferencedBy.length > 0) {
        await awu(Object.values(element.fields)).forEach(async field => {
          // Since we only support referenceBy on a base elemID, a selector
          // that is not top level and that has referenceBy is necessarily a field selector
          if (
            await awu(subSelectorsWithReferencedBy).some(selector =>
              matchWithReferenceBy(field.elemID, selector, referenceSourcesIndex),
            )
          ) {
            subElementIDs.add(field.elemID.getFullName())
          }
        })
      }
    }
    await withLimitedConcurrency(
      stillRelevantIDs.map(elemID => () => addSubElementIDs(elemID)),
      MAX_SUB_ELEMENT_SELECTORS_CONCURRENCY,
    )
    return awu(topLevelIDs.concat(Array.from(subElementIDs).map(ElemID.fromFullName))).uniquify(id => id.getFullName())
  }, 'selectElementIdsByTraversal')
