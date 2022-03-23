/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, Field, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isModificationChange, ListType, Value } from '@salto-io/adapter-api'
import { FilterWith } from '../filter'
import { CONFIG_FEATURES } from '../constants'
import { FeaturesDeployError } from '../errors'
import { featuresType } from '../types/configuration_types'

const ENABLED = 'ENABLED'
const DISABLED = 'DISABLED'

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'> => ({
  onFetch: async elements => {
    const [featuresInstance] = elements.filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === CONFIG_FEATURES)

    if (!featuresInstance) return

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
      feature => (
        [ENABLED, DISABLED].includes(feature.status)
          ? feature.status === ENABLED
          : feature.status
      )
    )
  },
  preDeploy: async changes => {
    const [featuresChange] = changes.filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === CONFIG_FEATURES)

    if (!featuresChange) return

    const getStatus = (value: Value): Value => {
      if (_.isBoolean(value)) {
        return value ? ENABLED : DISABLED
      }
      return value
    }

    Object.values(featuresChange.data).forEach(instance => {
      instance.value = {
        feature: Object.entries(instance.value)
          .map(([id, value]) => ({ id, status: getStatus(value) })),
      }
    })

    const type = await getChangeData<InstanceElement>(featuresChange).getType()
    const { companyfeatures_feature: innerFeatureType } = featuresType()
    type.fields = {
      feature: new Field(type, 'feature', new ListType(innerFeatureType)),
    }
  },
  onDeploy: async (changes, deployInfo) => {
    const errorIds = deployInfo.errors.flatMap(error => {
      if (error instanceof FeaturesDeployError) {
        return error.ids
      }
      return []
    })

    if (errorIds.length === 0) return

    const [featuresChange] = changes
      .filter(isInstanceChange)
      .filter(isModificationChange)
      .filter(change => getChangeData(change).elemID.typeName === CONFIG_FEATURES)

    if (!featuresChange) return

    const { after, before } = featuresChange.data
    after.value = {
      ..._.omit(after.value, errorIds),
      ..._.pick(before.value, errorIds),
    }
  },
})

export default filterCreator
