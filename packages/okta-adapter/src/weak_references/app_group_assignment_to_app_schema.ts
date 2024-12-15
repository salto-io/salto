/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import {
  ElemID,
  GetCustomReferencesFunc,
  InstanceElement,
  ReferenceInfo,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { getParent } from '@salto-io/adapter-utils'
import { WeakReferencesHandler } from './weak_references_handler'
import { APP_USER_SCHEMA_TYPE_NAME, OKTA } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

const markInstancesAsStrongReference = async (instance: InstanceElement): Promise<ReferenceInfo[]> => {
  const { profile } = instance.value
  if (profile === undefined || !_.isObject(profile)) {
    log.trace(
      `profile field is undefined or not an object in instance ${instance.elemID.getFullName()}, hence not adding references`,
    )
    return []
  }
  const parent = getParent(instance)

  return awu(Object.keys(profile))
    .map(async key => ({
      source: instance.elemID,
      target: ElemID.fromFullNameParts([
        OKTA,
        APP_USER_SCHEMA_TYPE_NAME,
        'instance',
        parent.elemID.name,
        'definitions',
        'custom',
        'properties',
        key,
      ]),
      type: 'strong' as const,
    }))
    .filter(values.isDefined)
    .toArray()
}

/**
 * Marks each instance of ApplicationGroupAssignment as a strong reference to appUserSchema custom field.
 */
const getAppUserSchemaCustomFieldsReferences: GetCustomReferencesFunc = async elements =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === 'ApplicationGroupAssignment')
    .flatMap(markInstancesAsStrongReference)
    .toArray()

export const groupAssignmentToAppUserSchemaHandler: WeakReferencesHandler = {
  findWeakReferences: getAppUserSchemaCustomFieldsReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
