/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { isObjectType, CORE_ANNOTATIONS, isInstanceElement, TypeReference, BuiltinTypes } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import {
  OBJECT_SCHEMA_TYPE,
  OBJECT_TYPE_ATTRIBUTE_TYPE,
  OBJECT_TYPE_TYPE,
  OBJECT_SCHEMA_STATUS_TYPE,
  CALENDAR_TYPE,
  CUSTOMER_PERMISSIONS_TYPE,
  PORTAL_GROUP_TYPE,
  PORTAL_SETTINGS_TYPE_NAME,
  QUEUE_TYPE,
  REQUEST_TYPE_NAME,
  SLA_TYPE_NAME,
  OBJECT_SCHMEA_REFERENCE_TYPE_TYPE,
  OBJECT_SCHMEA_DEFAULT_REFERENCE_TYPE_TYPE,
  OBJECT_TYPE_ICON_TYPE,
  OBJECT_SCHEMA_GLOBAL_STATUS_TYPE,
  SLA_CONDITIONS_STOP_TYPE,
  SLA_CONDITIONS_START_TYPE,
  SLA_CONDITIONS_PAUSE_TYPE,
} from '../constants'
import { setTypeDeploymentAnnotations, addAnnotationRecursively, findObject } from '../utils'

const { awu } = collections.asynciterable
const jsmSupportedTypes = [
  CUSTOMER_PERMISSIONS_TYPE,
  QUEUE_TYPE,
  CALENDAR_TYPE,
  REQUEST_TYPE_NAME,
  PORTAL_GROUP_TYPE,
  PORTAL_SETTINGS_TYPE_NAME,
  SLA_TYPE_NAME,
]

const assetsSupportedTypes = [
  OBJECT_SCHEMA_TYPE,
  OBJECT_SCHEMA_STATUS_TYPE,
  OBJECT_TYPE_TYPE,
  OBJECT_TYPE_ATTRIBUTE_TYPE,
  OBJECT_SCHMEA_REFERENCE_TYPE_TYPE,
  OBJECT_SCHMEA_DEFAULT_REFERENCE_TYPE_TYPE,
  OBJECT_SCHEMA_GLOBAL_STATUS_TYPE,
  OBJECT_TYPE_ICON_TYPE,
]

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'jsmTypesFetchFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    await awu(elements)
      .filter(e => jsmSupportedTypes.includes(e.elemID.typeName) || assetsSupportedTypes.includes(e.elemID.typeName))
      .filter(isObjectType)
      .forEach(async obj => {
        setTypeDeploymentAnnotations(obj)
        await addAnnotationRecursively(obj, CORE_ANNOTATIONS.CREATABLE)
        await addAnnotationRecursively(obj, CORE_ANNOTATIONS.UPDATABLE)
        await addAnnotationRecursively(obj, CORE_ANNOTATIONS.DELETABLE)
      })
    elements
      .filter(e => jsmSupportedTypes.includes(e.elemID.typeName))
      .filter(isInstanceElement)
      .forEach(inst => {
        inst.annotations[CORE_ANNOTATIONS.PARENT] = [inst.value.projectKey]
        delete inst.value.projectKey
      })
    const objectTypeIconType = findObject(elements, OBJECT_TYPE_ICON_TYPE)
    if (objectTypeIconType !== undefined) {
      objectTypeIconType.fields.icon.annotations[CORE_ANNOTATIONS.UPDATABLE] = false
    }

    // SLA
    ;[SLA_CONDITIONS_STOP_TYPE, SLA_CONDITIONS_START_TYPE, SLA_CONDITIONS_PAUSE_TYPE].forEach(slaTypeName => {
      const slaType = findObject(elements, slaTypeName)
      if (slaType === undefined) {
        return
      }
      if (slaType.fields.conditionId !== undefined) {
        slaType.fields.conditionId.refType = new TypeReference(BuiltinTypes.UNKNOWN.elemID, BuiltinTypes.UNKNOWN)
      }
      // warn on deployment of name as it does nothing
      if (slaType.fields.name !== undefined) {
        slaType.fields.name.annotations[CORE_ANNOTATIONS.CREATABLE] = false
        slaType.fields.name.annotations[CORE_ANNOTATIONS.UPDATABLE] = false
      }
    })
  },
})
export default filterCreator
