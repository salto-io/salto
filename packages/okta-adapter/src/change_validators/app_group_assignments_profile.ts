/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isAdditionOrModificationChange,
  InstanceElement,
} from '@salto-io/adapter-api'
import { getElementPrettyName, getInstancesFromElementSource, getParentElemID } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { APP_GROUP_ASSIGNMENT_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME } from '../constants'

const log = logger(module)
const { isDefined } = lowerDashValues

const getMissingProperties = (
  appGroupInstance: InstanceElement,
  appUserSchemaInstance: InstanceElement | undefined,
): { instance: InstanceElement; missingProperties: string[] } | undefined => {
  const { profile } = appGroupInstance.value
  if (profile === undefined || !_.isObject(profile)) {
    log.trace(`profile field is undefined or not an object in instance ${appGroupInstance.elemID.getFullName()}`)
    return undefined
  }
  const profileKeys = Object.keys(profile)
  const properties = appUserSchemaInstance?.value.definitions.custom.properties
  if (properties === undefined || !_.isObject(properties)) {
    log.trace(
      `properties field is undefined or not an object in instance ${appUserSchemaInstance?.elemID.getFullName()}`,
    )
    return undefined
  }
  const propertiesKeys = new Set(Object.keys(properties))
  const missingKeys = profileKeys.filter(attribute => !propertiesKeys.has(attribute))
  return missingKeys.length > 0
    ? {
        instance: appGroupInstance,
        missingProperties: missingKeys,
      }
    : undefined
}

/*
 * Ensures that only ApplicationGroupAssignments with attributes defined in the appUserSchema are deployed.
 */
export const appGroupAssignmentProfileValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run appGroupAssignmentProfileValidator because element source is undefined')
    return []
  }
  const appUserSchemas = await getInstancesFromElementSource(elementSource, [APP_USER_SCHEMA_TYPE_NAME])
  const appUserSchemaByAppName = _.keyBy(appUserSchemas, instance => getParentElemID(instance).getFullName())

  return changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === APP_GROUP_ASSIGNMENT_TYPE_NAME)
    .map(getChangeData)
    .map(instance => getMissingProperties(instance, appUserSchemaByAppName[getParentElemID(instance).getFullName()]))
    .filter(isDefined)
    .map(({ instance, missingProperties }) => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot deploy group assignments with missing profile attributes',
      detailedMessage: `The following profile attributes [${missingProperties.join(',')}] are missing in ${getElementPrettyName(appUserSchemaByAppName[getParentElemID(instance).getFullName()])}. Please add them to the app user schema or remove them from this instance`,
    }))
}
