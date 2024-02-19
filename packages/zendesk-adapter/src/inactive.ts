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
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { config as configUtils, definitions } from '@salto-io/adapter-components'
import { ZendeskConfig, API_DEFINITIONS_CONFIG, FETCH_CONFIG } from './config'
import { TICKET_FORM_TYPE_NAME, WEBHOOK_TYPE_NAME } from './constants'

/**
 * Helper for omitting inactive instances during the initial fetch, in order to avoid creating their standalone
 * child instances.
 * Note: We assume all instances are of the same type.
 */
export const filterOutInactiveInstancesForType = (
  config: ZendeskConfig,
): ((instances: InstanceElement[]) => InstanceElement[]) => {
  const apiDefinitions = config[API_DEFINITIONS_CONFIG]
  const omitInactiveConfig = config[FETCH_CONFIG]?.omitInactive
  const newOmitInactiveQuery = omitInactiveConfig ? definitions.queryWithDefault(omitInactiveConfig) : undefined
  return instances => {
    if (instances.length === 0) {
      return instances
    }
    const { typeName } = instances[0].elemID

    // We can't omit inactive ticket_form instances because we need all the instance in order to reorder them
    // if we decide to omit inactive ticket_form
    // we will need to add warning in the ticket_field_deactivation change validator
    // TODO SALTO-5420 remove the omitInactive migration
    const oldOmitInactive = _.get(
      configUtils.getConfigWithDefault(
        apiDefinitions.types?.[typeName]?.transformation,
        apiDefinitions.typeDefaults.transformation,
      ),
      'omitInactive',
    )
    const newOmitInactive = newOmitInactiveQuery ? newOmitInactiveQuery.query(typeName) : false
    if (
      typeName === TICKET_FORM_TYPE_NAME ||
      (oldOmitInactive === undefined && !newOmitInactive) ||
      oldOmitInactive === false
    ) {
      return instances
    }
    if (typeName === WEBHOOK_TYPE_NAME) {
      return instances.filter(instance => instance.value.status !== 'inactive')
    }
    return instances.filter(instance => instance.value.active !== false)
  }
}
