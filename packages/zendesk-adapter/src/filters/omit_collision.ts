/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceElement, Element, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { config as configUtils, filters } from '@salto-io/adapter-components'
import { getAndLogCollisionWarnings, getInstancesWithCollidingElemID } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { ZENDESK } from '../constants'
import { API_DEFINITIONS_CONFIG } from '../config'

const log = logger(module)
const removeChildElements = (elements: Element[], collidingElements: InstanceElement[]): void => {
  const collidingElementsNames = new Set(collidingElements.map(e => e.elemID.getFullName()))
  const graph = filters.createParentChildGraph(elements.filter(isInstanceElement))
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
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'omitCollisionsFilter',
  onFetch: async (elements: Element[]) => {
    const collidingElements = getInstancesWithCollidingElemID(elements.filter(isInstanceElement))
    const collidingElemIds = new Set(collidingElements.map(elem => elem.elemID.getFullName()))
    removeChildElements(elements, collidingElements)
    const collisionWarnings = await getAndLogCollisionWarnings({
      adapterName: ZENDESK,
      configurationName: 'service',
      instances: collidingElements,
      getTypeName: async instance => instance.elemID.typeName,
      getInstanceName: async instance => instance.elemID.name,
      getIdFieldsByType: typeName =>
        configUtils.getConfigWithDefault(
          config[API_DEFINITIONS_CONFIG].types[typeName]?.transformation,
          config[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
        ).idFields,
      idFieldsName: 'idFields',
      docsUrl: 'https://help.salto.io/en/articles/6927157-salto-id-collisions',
      addChildrenMessage: true,
    })
    _.remove(elements, e => collidingElemIds.has(e.elemID.getFullName()))
    return { errors: collisionWarnings }
  },
})

export default filterCreator
