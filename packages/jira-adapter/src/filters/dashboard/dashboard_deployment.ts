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
import { Element, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { findObject, setFieldDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { DASHBOARD_GADGET_POSITION_TYPE, DASHBOARD_TYPE } from '../../constants'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { deployLayout } from './dashboard_layout'

const log = logger(module)

const filter: FilterCreator = ({ client, config }) => ({
  name: 'dashboardFilter',
  onFetch: async (elements: Element[]) => {
    const gadgetPositionType = findObject(elements, DASHBOARD_GADGET_POSITION_TYPE)
    if (gadgetPositionType === undefined) {
      log.warn(`${DASHBOARD_GADGET_POSITION_TYPE} type not found`)
    } else {
      setFieldDeploymentAnnotations(gadgetPositionType, 'row')
      setFieldDeploymentAnnotations(gadgetPositionType, 'column')
    }

    const dashboardType = findObject(elements, DASHBOARD_TYPE)
    if (dashboardType === undefined) {
      log.warn(`${DASHBOARD_TYPE} type not found`)
      return
    }

    setFieldDeploymentAnnotations(dashboardType, 'gadgets')

    if (config.client.usePrivateAPI) {
      setFieldDeploymentAnnotations(dashboardType, 'layout')
    }
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === DASHBOARD_TYPE
        && isAdditionOrModificationChange(change)
    )


    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange),
      async change => {
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: config.apiDefinitions,
          fieldsToIgnore: [
            'layout',
            'gadgets',
          ],
        })

        await deployLayout(change, client)
      }
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
