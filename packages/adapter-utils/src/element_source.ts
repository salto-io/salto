/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ReadOnlyElementsSource, Element, ElemID, Value, isElement, GLOBAL_ADAPTER } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { resolvePath, resolveTypeShallow } from './utils'
import { createAdapterReplacedID, updateElementsWithAlternativeAccount } from '@salto-io/workspace'

const { awu } = collections.asynciterable

const { findDuplicates } = collections.array
const { isDefined } = values
const log = logger(module)

export const buildElementsSourceFromElements = (
  elements: ReadonlyArray<Readonly<Element>>,
  fallbackSources: ReadOnlyElementsSource[] = [],
): ReadOnlyElementsSource => {
  const elementsMap = _.keyBy(elements, e => e.elemID.getFullName())
  if (Object.keys(elementsMap).length !== elements.length) {
    const duplicateNames = findDuplicates(elements.map(e => e.elemID.getFullName()))
    log.warn(`duplicate ElemIDs of elementSource found. the duplicates are ${duplicateNames}`)
  }

  let self: ReadOnlyElementsSource

  async function* getIds(): AsyncIterable<ElemID> {
    for (const element of elements) {
      yield element.elemID
    }
    const returnedIds = new Set(Object.keys(elementsMap))

    for (const fallbackSource of fallbackSources) {
      // eslint-disable-next-line no-await-in-loop
      for await (const elemID of await fallbackSource.list()) {
        if (!returnedIds.has(elemID.getFullName())) {
          returnedIds.add(elemID.getFullName())
          yield elemID
        }
      }
    }
  }

  async function* getElements(): AsyncIterable<Element> {
    for (const element of elements) {
      yield element.clone()
    }
    const returnedIds = new Set(Object.keys(elementsMap))

    for (const fallbackSource of fallbackSources) {
      // eslint-disable-next-line no-await-in-loop
      for await (const element of await fallbackSource.getAll()) {
        if (!returnedIds.has(element.elemID.getFullName())) {
          returnedIds.add(element.elemID.getFullName())
          const clonedElement = element.clone()
          try {
            await resolveTypeShallow(clonedElement, self)
          } catch (err) {
            log.warn(`failed to resolve type for ${element.elemID.getFullName()}: ${err.message}`)
          }
          yield clonedElement
        }
      }
    }
  }

  const getValueByID = (id: ElemID): Value => {
    const baseId = id.createBaseID().parent
    const topLevelParentId = id.createTopLevelParentID().parent
    const element = elementsMap[baseId.getFullName()] ?? elementsMap[topLevelParentId.getFullName()]
    return element && resolvePath(element, id)
  }

  const get = async (id: ElemID): Promise<Value> => {
    const value = getValueByID(id)
    if (value !== undefined) {
      return value
    }

    return awu(fallbackSources)
      .map(source => source.get(id))
      .find(values.isDefined)
  }

  const has = async (id: ElemID): Promise<boolean> =>
    getValueByID(id) !== undefined || awu(fallbackSources).some(source => source.has(id))

  self = {
    getAll: async () => getElements(),
    get,
    list: async () => getIds(),
    has,
  }
  return self
}

export const buildLazyShallowTypeResolverElementsSource = (
  elementsSource: ReadOnlyElementsSource,
): ReadOnlyElementsSource => {
  const resolved: Record<string, Element> = {}
  const getElementWithResolvedShallowType = async (value: Value): ReturnType<ReadOnlyElementsSource['get']> => {
    if (!isElement(value)) {
      return value
    }
    const id = value.elemID.getFullName()
    const resolvedElement = resolved[id]
    if (isDefined(resolvedElement)) {
      return resolvedElement
    }
    await resolveTypeShallow(value, elementsSource)
    resolved[id] = value
    return value
  }
  return {
    get: async (id: ElemID) => getElementWithResolvedShallowType(await elementsSource.get(id)),
    getAll: async () => awu(await elementsSource.getAll()).map(getElementWithResolvedShallowType),
    list: async () => elementsSource.list(),
    has: async (id: ElemID) => elementsSource.has(id),
  }
}

export const createElemIDReplacedElementsSource = (
  elementsSource: ReadOnlyElementsSource,
  account: string,
  adapter: string,
): ReadOnlyElementsSource =>
  account === adapter
    ? elementsSource
    : {
        getAll: async () =>
          awu(await elementsSource.getAll()).map(async element => {
            const ret = element.clone()
            await updateElementsWithAlternativeAccount([ret], adapter, account, elementsSource)
            return ret
          }),
        get: async id => {
          const element = (await elementsSource.get(createAdapterReplacedID(id, account)))?.clone()
          if (element) {
            await updateElementsWithAlternativeAccount([element], adapter, account, elementsSource)
          }
          return element
        },
        list: async () => awu(await elementsSource.list()).map(id => createAdapterReplacedID(id, adapter)),
        has: async id => {
          const transformedId = createAdapterReplacedID(id, account)
          return elementsSource.has(transformedId)
        },
      }

export const filterElementsSource = (
  elementsSource: ReadOnlyElementsSource,
  accountName: string,
): ReadOnlyElementsSource => {
  const isRelevantID = (elemID: ElemID): boolean => elemID.adapter === accountName || elemID.adapter === GLOBAL_ADAPTER
  return {
    getAll: async () => awu(await elementsSource.getAll()).filter(elem => isRelevantID(elem.elemID)),
    get: async id => (isRelevantID(id) ? elementsSource.get(id) : undefined),
    list: async () => awu(await elementsSource.list()).filter(isRelevantID),
    has: async id => (isRelevantID(id) ? elementsSource.has(id) : false),
  }
}
