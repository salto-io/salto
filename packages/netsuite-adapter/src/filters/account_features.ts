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
import { getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { FilterWith } from '../filter'
import { ACCOUNT_FEATURES } from '../constants'
import { FeaturesDeployError } from '../errors'

const filterCreator = (): FilterWith<'onDeploy'> => ({
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
      .filter(change => getChangeData(change).elemID.typeName === ACCOUNT_FEATURES)

    if (!featuresChange) return

    const { after, before } = featuresChange.data
    const fixedFeatures = {
      ..._.omit(after.value.features, errorIds),
      ..._.pick(before.value.features, errorIds),
    }
    featuresChange.data.after.value.features = fixedFeatures
  },
})

export default filterCreator
