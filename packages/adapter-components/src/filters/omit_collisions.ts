/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isInstanceElement, Element, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getAndLogCollisionWarnings, getInstancesWithCollidingElemID, filter } from '@salto-io/adapter-utils'
import { APIDefinitionsOptions, queryWithDefault } from '../definitions'
import { AdapterFilterCreator } from '../filter_utils'
import { createParentChildGraph } from './query'

const log = logger(module)
export const removeChildElements = (elements: Element[], collidingElements: InstanceElement[]): void => {
  const collidingElementsNames = new Set(collidingElements.map(e => e.elemID.getFullName()))
  const graph = createParentChildGraph(elements.filter(isInstanceElement))
  const additionalIDsToRemove = graph.getComponent({
    roots: collidingElements.map(e => e.elemID.getFullName()),
    reverse: true,
  })
  const dependentRemovedInstances = _.remove(
    elements,
    element =>
      additionalIDsToRemove.has(element.elemID.getFullName()) &&
      !collidingElementsNames.has(element.elemID.getFullName()),
  )
  log.debug(
    `Instances removed because their parent was removed due to elemId collision: ${dependentRemovedInstances.map(inst => inst.elemID.getFullName()).join('\n')}`,
  )
}

/**
 * Adds collision warnings and remove colliding elements and their children
 */
export const omitCollisionsFilterCreator =
  <TOptions extends APIDefinitionsOptions = {}>(
    adapterName: string,
  ): AdapterFilterCreator<{}, filter.FilterResult, {}, TOptions> =>
  ({ definitions }) => ({
    name: 'omitCollisionsFilter',
    onFetch: async (elements: Element[]) => {
      const defQuery = queryWithDefault(definitions?.fetch?.instances ?? {})
      const collidingElements = getInstancesWithCollidingElemID(elements.filter(isInstanceElement))
      const collidingElemIds = new Set(collidingElements.map(elem => elem.elemID.getFullName()))
      removeChildElements(elements, collidingElements)
      const collisionWarnings = await getAndLogCollisionWarnings({
        adapterName,
        configurationName: 'service',
        instances: collidingElements,
        getTypeName: async instance => instance.elemID.typeName,
        getInstanceName: async instance => instance.elemID.name,
        getIdFieldsByType: typeName =>
          defQuery.query(typeName)?.element?.topLevel?.elemID?.parts?.map(part => part.fieldName) ?? [],
        idFieldsName: 'elemID configuration',
        docsUrl: 'https://help.salto.io/en/articles/6927157-salto-id-collisions',
        addChildrenMessage: true,
      })
      _.remove(elements, e => collidingElemIds.has(e.elemID.getFullName()))
      return { errors: collisionWarnings }
    },
  })
