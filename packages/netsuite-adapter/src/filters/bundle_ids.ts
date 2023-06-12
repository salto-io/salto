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

import { getChangeData, InstanceElement, isInstanceChange, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { getServiceId, isFileCabinetType } from '../types'
import { LocalFilterCreator } from '../filter'
import { BUNDLE_ID_TO_COMPONENTS } from '../autogen/bundle_components/bundle_components'
import { getGroupItemFromRegex } from '../client/utils'

const log = logger(module)
const BUNDLE_ID = 'bundleId'
const bundleIdRegex = RegExp(`Bundle (?<${BUNDLE_ID}>\\d+)`, 'g')
const PRIVATE_BUNDLE_STRING = 'Private'
const { awu } = collections.asynciterable

const addBundleIdField = async (
  instance: InstanceElement,
  bundleInstances: InstanceElement[],
  bundleIdToInstance: Record<string, InstanceElement>
): Promise<void> => {
  const serviceId = getServiceId(instance)
  const instanceType = await instance.getType()
  if (isFileCabinetType(instanceType)) {
    const bundleId = getGroupItemFromRegex(serviceId, bundleIdRegex, BUNDLE_ID)
    if (bundleId.length > 0) {
      const bundleToReference = bundleIdToInstance[bundleId[0]]
      Object.assign(instance.value, { bundleId: new ReferenceExpression(bundleToReference.elemID) })
    }
  } else {
    bundleInstances.forEach(bundle => {
      if (BUNDLE_ID_TO_COMPONENTS[bundle.value.id].has(serviceId)) {
        Object.assign(instance.value, { bundleId: new ReferenceExpression(bundle.elemID) })
      }
    })
  }
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'bundleIds',
  onFetch: async elements => {
    const [bundleInstances, nonBundleElements] = _.partition(
      elements.filter(isInstanceElement), element => element.elemID.typeName === 'bundle'
    )
    const [existingBundles, missingBundles] = _.partition(bundleInstances, bundle =>
      bundle.value.id in BUNDLE_ID_TO_COMPONENTS)
    log.debug('The following bundle ids are missing in the bundle record: %o', missingBundles.map(bundle => bundle.value.id))

    const bundleIdToInstance: Record<string, InstanceElement> = Object.fromEntries(
      bundleInstances.map(bundle => [bundle.value.id, bundle])
    )
    existingBundles.forEach(bundle => {
      bundle.value.isPrivate = BUNDLE_ID_TO_COMPONENTS[bundle.value.id].has(PRIVATE_BUNDLE_STRING)
    })
    await awu(nonBundleElements).forEach(element => (addBundleIdField(element, existingBundles, bundleIdToInstance)))
  },

  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .forEach(element => { element.value = _.omit(element.value, [BUNDLE_ID]) })
  },
})

export default filterCreator
