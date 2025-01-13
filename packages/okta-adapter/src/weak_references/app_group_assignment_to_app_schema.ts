/*
 * Copyright 2025 Salto Labs Ltd.
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
import { values } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import { WeakReferencesHandler } from './weak_references_handler'
import { APP_GROUP_ASSIGNMENT_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME, OKTA } from '../constants'
import { USER_SCHEMA_CUSTOM_PATH } from '../filters/expression_language'

const markInstancesAsStrongReference = (instance: InstanceElement): ReferenceInfo[] => {
  const { profile } = instance.value
  if (profile === undefined || !_.isPlainObject(profile)) {
    return []
  }
  const parent = getParent(instance)

  /**
   * We always creates references to custom properties, even for attribute to base properties,
   * since we don't have the element source and we assume that base properties are not changeable.
   * we assumes that the element ID for the AppUserSchema matches the App element ID.
   */
  return Object.keys(profile)
    .map(key => ({
      source: instance.elemID,
      target: ElemID.fromFullNameParts([
        OKTA,
        APP_USER_SCHEMA_TYPE_NAME,
        'instance',
        parent.elemID.name,
        ...USER_SCHEMA_CUSTOM_PATH,
        key,
      ]),
      sourceScope: 'value' as const,
      type: 'strong' as const,
    }))
    .filter(values.isDefined)
}

/**
 * Marks each instance of ApplicationGroupAssignment as a strong reference to the AppUserSchema custom field.
 * This is achieved using a custom reference mechanism rather than being explicitly written in the nacl, since
 * the source reference is determined by the key, not the value, and we avoid introducing an additional field.
 */
const getAppUserSchemaCustomFieldsReferences: GetCustomReferencesFunc = async elements =>
  elements
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === APP_GROUP_ASSIGNMENT_TYPE_NAME)
    .flatMap(markInstancesAsStrongReference)

export const groupAssignmentToAppUserSchemaHandler: WeakReferencesHandler = {
  findWeakReferences: getAppUserSchemaCustomFieldsReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
