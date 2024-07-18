/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  Change,
  InstanceElement,
  ReferenceExpression,
  // SaltoElementError,
  // SeverityLevel,
  getChangeData,
  // isAdditionChange,
  isInstanceChange,
  isRemovalChange,
  // isModificationChange,
  // isRemovalChange,
  // isSaltoError,
} from '@salto-io/adapter-api'
// import { logger } from '@salto-io/logging'
import _ from 'lodash'
// import { getParent } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import {
  // FIELD_CONTEXT_OPTION_TYPE_NAME,
  // FIELD_CONTEXT_OPTIONS_ORDER_FILE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from './constants'
// import { setContextOptionsSplitted } from './context_options_splitted'
import { deployChanges } from '../../deployment/standard_deployment'
import { getContextAndFieldIds } from '../../common/fields'
import { reorderContextOptions } from './context_options_splitted'

// const log = logger(module)

const filter: FilterCreator = ({ config, client }) => ({
  name: 'fieldContextOptionsOrderDeploymentFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === OPTIONS_ORDER_TYPE_NAME,
    ) as [Change<InstanceElement>[], Change[]]
    if (!config.fetch.splitFieldContextOptions || relevantChanges.length === 0) {
      return { leftoverChanges, deployResult: { errors: [], appliedChanges: [] } }
    }

    const deployResult = await deployChanges(relevantChanges, async change => {
      // no need to remove orders
      if (isRemovalChange(change)) {
        return
      }
      const { contextId, fieldId } = getContextAndFieldIds(change)
      const baseUrl = `/rest/api/3/field/${fieldId}/context/${contextId}/option`
      const optionsValues = getChangeData(change).value.options?.map(
        (optionRef: ReferenceExpression) => optionRef.value.value,
      )
      await reorderContextOptions(optionsValues, client, baseUrl)
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})
export default filter
