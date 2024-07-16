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
  SaltoElementError,
  SeverityLevel,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isSaltoError,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from './constants'
import { setContextOptionsSplitted } from './context_options_splitted'
import { getContextAndFieldIds } from '../../common/fields'

const log = logger(module)

const filter: FilterCreator = ({ config, client, paginator }) => ({
  name: 'fieldContextOptionsFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME,
    ) as [Change<InstanceElement>[], Change[]]
    if (!config.fetch.splitFieldContextOptions || relevantChanges.length === 0) {
      return { leftoverChanges, deployResult: { errors: [], appliedChanges: [] } }
    }
    const errors: SaltoElementError[] = []
    let appliedChanges = relevantChanges

    const { contextId, fieldId } = getContextAndFieldIds(relevantChanges[0])
    if (
      relevantChanges
        .map(getContextAndFieldIds)
        .find(
          ({ contextId: currContextId, fieldId: currFieldId }) =>
            currContextId !== contextId || currFieldId !== fieldId,
        ) !== undefined
    ) {
      log.error('All field context options must be of the same context and field')
      return {
        leftoverChanges,
        deployResult: {
          errors: relevantChanges.map(change => ({
            message: 'All field context options must be of the same context and field',
            severity: 'Error' as SeverityLevel,
            elemID: getChangeData(change).elemID,
          })),
          appliedChanges: [],
        },
      }
    }

    const [addChanges, modifyOrRemoveChanges] = _.partition(relevantChanges.filter(isInstanceChange), change =>
      isAdditionChange(change),
    )
    const [modifyChanges, removeChanges] = _.partition(modifyOrRemoveChanges, change => isModificationChange(change))
    try {
      await setContextOptionsSplitted({
        contextId,
        fieldId,
        added: addChanges.map(getChangeData),
        modified: modifyChanges.map(getChangeData),
        removed: removeChanges.map(getChangeData),
        client,
        paginator,
      })
      // update the ids of added options
      addChanges.map(getChangeData).forEach(instance => {
        leftoverChanges
          .map(getChangeData)
          .filter(isInstanceElement)
          .filter(relevantInstance => relevantInstance.elemID.typeName === OPTIONS_ORDER_TYPE_NAME)
          .forEach(orderInstance => {
            orderInstance.value.options.forEach((optionRef: ReferenceExpression) => {
              if (optionRef.value.elemID.isEqual(instance.elemID)) {
                optionRef.value.value.id = instance.value.id
              }
            })
          })
      })
    } catch (err) {
      if (isSaltoError(err) && err.severity !== 'Error') {
        log.error('An error occurred during deployment of custom field context options: %o', err.message)

        errors.push(
          ...changes.map(change => ({
            message: err.message,
            severity: err.severity,
            elemID: getChangeData(change).elemID,
          })),
        )
      } else {
        log.error('An error occurred during deployment of custom field context options: %o', err)
        errors.push(
          ...changes.map(change => ({
            message: `${err}`,
            severity: 'Error' as SeverityLevel,
            elemID: getChangeData(change).elemID,
          })),
        )
      }
      appliedChanges = []
    }

    return {
      leftoverChanges,
      deployResult: {
        errors,
        appliedChanges,
      },
    }
  },
})
export default filter
