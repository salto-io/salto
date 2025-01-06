/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceElement, Element } from '@salto-io/adapter-api'
import { config as configUtils, filters } from '@salto-io/adapter-components'
import { getAndLogCollisionWarnings, getInstancesWithCollidingElemID } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { ZENDESK } from '../constants'

/**
 * Adds collision warnings and remove colliding elements and their children
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions }) => ({
  name: 'omitCollisionsFilter',
  onFetch: async (elements: Element[]) => {
    const collidingElements = getInstancesWithCollidingElemID(elements.filter(isInstanceElement))
    const collidingElemIds = new Set(collidingElements.map(elem => elem.elemID.getFullName()))
    filters.removeChildElements(elements, collidingElements)
    const collisionWarnings = await getAndLogCollisionWarnings({
      adapterName: ZENDESK,
      configurationName: 'service',
      instances: collidingElements,
      getTypeName: async instance => instance.elemID.typeName,
      getInstanceName: async instance => instance.elemID.name,
      getIdFieldsByType: typeName =>
        configUtils.getConfigWithDefault(
          oldApiDefinitions.types[typeName]?.transformation,
          oldApiDefinitions.typeDefaults.transformation,
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
