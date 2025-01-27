/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceElement, Element } from '@salto-io/adapter-api'
import { filters } from '@salto-io/adapter-components'
import { getCollisionWarnings, getInstancesWithCollidingElemID } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { ZENDESK } from '../constants'
import { FilterCreator } from '../filter'

/**
 * Adds collision warnings and remove colliding elements and their children
 */
const filterCreator: FilterCreator = () => ({
  name: 'omitCollisionsFilter',
  onFetch: async (elements: Element[]) => {
    const collidingElements = getInstancesWithCollidingElemID(elements.filter(isInstanceElement))
    const collidingElemIds = new Set(collidingElements.map(elem => elem.elemID.getFullName()))
    filters.removeChildElements(elements, collidingElements)
    const collisionWarnings = getCollisionWarnings({
      instances: collidingElements,
      addChildrenMessage: true,
      adapterName: _.upperFirst(ZENDESK),
    })
    _.remove(elements, e => collidingElemIds.has(e.elemID.getFullName()))
    return { errors: collisionWarnings }
  },
})

export default filterCreator
