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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { BuiltinTypes, Field, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isModificationChange } from '@salto-io/adapter-api'
import { FilterWith } from '../filter'
import { CONFIG_FEATURES } from '../constants'
import { FeaturesDeployError } from '../client/errors'
import { featuresType } from '../types/configuration_types'

const log = logger(module)

const ENABLED = 'ENABLED'
const DISABLED = 'DISABLED'

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'> => ({
  name: 'configFeaturesFilter',
  onFetch: async elements => {
    const featuresInstance = elements.filter(isInstanceElement)
      .find(instance => instance.elemID.typeName === CONFIG_FEATURES)

    if (!featuresInstance) {
      // removing the features type from elements because otherwise the current type
      // (in case of partial fetch) will be override without the real fields.
      _.remove(elements, element => element.elemID.typeName === CONFIG_FEATURES)
      return
    }

    const type = await featuresInstance.getType()
    const features = _.keyBy(featuresInstance.value.feature, feature => feature.id)

    type.fields = _.mapValues(features, feature => new Field(
      type,
      feature.id,
      BuiltinTypes.BOOLEAN,
      { label: feature.label }
    ))

    featuresInstance.value = _.mapValues(
      features,
      feature => {
        if (![ENABLED, DISABLED].includes(feature.status)) {
          log.warn('status attribute of feature %s is invalid: %o', feature.id, feature.status)
          return feature.status
        }
        return feature.status === ENABLED
      }
    )
  },
  preDeploy: async changes => {
    const featuresChange = changes.filter(isInstanceChange)
      .find(change => getChangeData(change).elemID.typeName === CONFIG_FEATURES)

    if (!featuresChange) return

    Object.values(featuresChange.data).forEach(instance => {
      instance.value = {
        feature: Object.entries(instance.value)
          .map(([id, value]) => {
            if (!_.isBoolean(value)) {
              log.warn('value of feature %s is not boolean: %o', id, value)
              return { id, status: value }
            }
            return { id, status: value ? ENABLED : DISABLED }
          }),
      }
    })

    const type = await getChangeData<InstanceElement>(featuresChange).getType()
    // restore the fields to the hardcoded definitions, used in fetch & deploy
    type.fields = featuresType().fields
  },
  onDeploy: async (changes, deployInfo) => {
    const errorIds = deployInfo.errors.flatMap(error => {
      if (error instanceof FeaturesDeployError) {
        return error.ids
      }
      return []
    })

    if (errorIds.length === 0) return

    const featuresChange = changes
      .filter(isInstanceChange)
      .filter(isModificationChange)
      .find(change => getChangeData(change).elemID.typeName === CONFIG_FEATURES)

    if (!featuresChange) return

    const { after, before } = featuresChange.data
    after.value = {
      ..._.omit(after.value, errorIds),
      ..._.pick(before.value, errorIds),
    }
  },
})

export default filterCreator
