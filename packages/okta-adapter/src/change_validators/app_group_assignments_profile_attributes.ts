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
import {
  getElementPrettyName,
  getInstancesFromElementSource,
  getParentElemID,
  resolvePath,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { APP_GROUP_ASSIGNMENT_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME } from '../constants'
import { USER_SCHEMA_CUSTOM_PATH } from '../filters/expression_language'

const log = logger(module)
const { isDefined } = lowerDashValues

/* Finds attributes in the `profile` field of an AppGroupAssignment instance that are not defined in the associated AppUserSchema.
 * Missing properties are attributes present in the `profile` but absent in the schema's custom properties.
 */
const getMissingProperties = (
  appGroupInstance: InstanceElement,
  appUserSchemaInstance: InstanceElement | undefined,
): { instance: InstanceElement; missingProperties: string[] } | undefined => {
  if (appUserSchemaInstance === undefined) {
    log.trace(
      `Cannot get custom properties for ${appGroupInstance.elemID.getFullName()} since its app user schema is undefined`,
    )
    return undefined
  }
  const { profile } = appGroupInstance.value
  if (profile === undefined || !_.isPlainObject(profile)) {
    log.trace(`profile field is undefined or not an object in instance ${appGroupInstance.elemID.getFullName()}`)
    return undefined
  }
  const profileKeys = Object.keys(profile)
  const properties = resolvePath(
    appUserSchemaInstance,
    appUserSchemaInstance.elemID.createNestedID(...USER_SCHEMA_CUSTOM_PATH),
  )
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
export const appGroupAssignmentProfileAttributesValidator: ChangeValidator = async (changes, elementSource) => {
  const appGroupAssignmentChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === APP_GROUP_ASSIGNMENT_TYPE_NAME)

  if (appGroupAssignmentChanges.length === 0) {
    return []
  }

  if (elementSource === undefined) {
    log.error('Failed to run appGroupAssignmentProfileAttributesValidator because element source is undefined')
    return []
  }
  const appUserSchemas = await getInstancesFromElementSource(elementSource, [APP_USER_SCHEMA_TYPE_NAME])
  const appUserSchemaByAppName = _.keyBy(appUserSchemas, instance => getParentElemID(instance).getFullName())

  return appGroupAssignmentChanges
    .map(getChangeData)
    .map(instance => getMissingProperties(instance, appUserSchemaByAppName[getParentElemID(instance).getFullName()]))
    .filter(isDefined)
    .map(({ instance, missingProperties }) => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'This element contains properties that are not defined in the application schema.',
      detailedMessage: `The following profile attributes are not defined in the related application schema: [${missingProperties.join(',')}]. Please add these attributes to the Application User Schema ${getElementPrettyName(appUserSchemaByAppName[getParentElemID(instance).getFullName()])} or remove them from this group assignment.`,
    }))
}
