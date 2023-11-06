/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { isInstanceElement, Element, isReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { config as configUtils, filters } from '@salto-io/adapter-components'
import { getAndLogCollisionWarnings, getInstancesWithCollidingElemID, getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { ZENDESK } from '../constants'
import { API_DEFINITIONS_CONFIG } from '../config'


const log = logger(module)


/**
 * Adds collision warnings
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'collisionErrorsFilter',
  onFetch: async (elements: Element[]) => {
    const collidingElements = getInstancesWithCollidingElemID(elements.filter(isInstanceElement))
    const collidingElementsNames = new Set(collidingElements.map(e => e.elemID.getFullName()))
    const graph = filters.createParentChildGraph(elements.filter(isInstanceElement))
    const additionalIDsToRemove = graph.getComponent({
      roots: collidingElements.map(e => e.elemID.getFullName()),
      reverse: true,
    })
    const dependentRemovedInstances = _.remove(
      elements,
      element => additionalIDsToRemove.has(element.elemID.getFullName())
        && !collidingElementsNames.has(element.elemID.getFullName())
    )
    const removedChildsByParent = _.groupBy(
      dependentRemovedInstances.filter(removedInst => {
        if (!isReferenceExpression(getParents(removedInst)[0])) {
          log.error(`${removedInst.elemID.getFullName()} does not have a parent`)
          return false
        }
        return true
      }),
      removedInst => getParents(removedInst)[0].elemID.getFullName()
    )
    const childWarning = Object.keys(removedChildsByParent)
      .map(parent =>
        `removed ${removedChildsByParent[parent].map(element => element.elemID.getFullName()).join(' , ')} as its parent ${parent} was removed due to collision of elemId`)
    log.debug(`${childWarning.join('\n')}`)
    const collisionWarnings = await getAndLogCollisionWarnings({
      adapterName: ZENDESK,
      configurationName: 'service',
      instances: collidingElements,
      getTypeName: async instance => instance.elemID.typeName,
      // TODO fix it to use apiName once we have apiName
      getInstanceName: async instance => instance.elemID.name,
      getIdFieldsByType: typeName => configUtils.getConfigWithDefault(
        config[API_DEFINITIONS_CONFIG].types[typeName]?.transformation,
        config[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
      ).idFields,
      idFieldsName: 'idFields',
      docsUrl: 'https://help.salto.io/en/articles/6927157-salto-id-collisions',
    })
    return { errors: collisionWarnings }
  },
})

export default filterCreator
