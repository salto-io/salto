/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { InstanceElement } from '@salto-io/adapter-api'
import { definitions, fetch } from '@salto-io/adapter-components'
import { ZendeskConfig, FETCH_CONFIG, OMIT_INACTIVE_DEFAULT } from './config'
import { TICKET_FORM_TYPE_NAME, WEBHOOK_TYPE_NAME } from './constants'

/**
 * Helper for omitting inactive instances during the initial fetch, in order to avoid creating their standalone
 * child instances.
 * Note: We assume all instances are of the same type.
 */
export const filterOutInactiveInstancesForType = (
  config: ZendeskConfig,
): ((instances: InstanceElement[]) => InstanceElement[]) => {
  const omitInactiveConfig = config[FETCH_CONFIG]?.omitInactive
  const omitInactiveQuery = omitInactiveConfig ? definitions.queryWithDefault(omitInactiveConfig) : undefined
  return instances => {
    if (instances.length === 0) {
      return instances
    }
    const { typeName } = instances[0].elemID

    // We can't omit inactive ticket_form instances because we need all the instance in order to reorder them
    // if we decide to omit inactive ticket_form
    // we will need to add warning in the ticket_field_deactivation change validator
    const omitInactive = omitInactiveQuery ? omitInactiveQuery.query(typeName) : OMIT_INACTIVE_DEFAULT
    if (typeName === TICKET_FORM_TYPE_NAME || !omitInactive) {
      return instances
    }
    if (typeName === WEBHOOK_TYPE_NAME) {
      return instances.filter(instance => instance.value.status !== 'inactive')
    }
    return instances.filter(instance => instance.value.active !== false)
  }
}

/**
 * Same as above, but for the new infra. The above function is removable after the migration to the new
 * infra is complete (SALTO-5760)
 */
export const filterOutInactiveItemForType = (config: ZendeskConfig): ((item: fetch.ValueGeneratedItem) => boolean) => {
  const omitInactiveConfig = config[FETCH_CONFIG]?.omitInactive
  const omitInactiveQuery = omitInactiveConfig ? definitions.queryWithDefault(omitInactiveConfig) : undefined
  return item => {
    const { typeName } = item

    // We can't omit inactive ticket_form instances because we need all the instance in order to reorder them
    // if we decide to omit inactive ticket_form
    // we will need to add warning in the ticket_field_deactivation change validator
    const omitInactive = omitInactiveQuery ? omitInactiveQuery.query(typeName) : OMIT_INACTIVE_DEFAULT
    if (typeName === TICKET_FORM_TYPE_NAME || !omitInactive) {
      return true
    }
    if (typeName === WEBHOOK_TYPE_NAME) {
      return item.value?.status !== 'inactive'
    }
    return item.value?.active !== false
  }
}
