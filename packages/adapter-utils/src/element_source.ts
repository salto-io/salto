/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ReadOnlyElementsSource, Element, ElemID, Value, isElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { resolvePath, resolveTypeShallow } from './utils'

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

    for await (const fallbackSource of fallbackSources) {
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

    for await (const fallbackSource of fallbackSources) {
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

  const getElement = (id: ElemID): Value => {
    const { parent } = id.createTopLevelParentID()
    const topLevelElement = elementsMap[parent.getFullName()]
    return elementsMap[id.getFullName()] ?? (topLevelElement && resolvePath(topLevelElement, id))
  }

  const get = async (id: ElemID): Promise<Value> => {
    const element = getElement(id)
    if (element !== undefined) {
      return element
    }

    return awu(fallbackSources)
      .map(source => source.get(id))
      .find(values.isDefined)
  }

  const has = async (id: ElemID): Promise<boolean> =>
    getElement(id) !== undefined || awu(fallbackSources).some(async source => source.has(id))

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
