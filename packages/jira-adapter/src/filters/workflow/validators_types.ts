/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ListType, ObjectType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { JIRA, VALIDATOR_CONFIGURATION } from '../../constants'

const statusRef = new ObjectType({
  elemID: new ElemID(JIRA, 'StatusRef'),
  fields: {
    id: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
  },
  path: [JIRA, elements.TYPES_PATH, 'StatusRef'],
})

const validatorConfigurationType = new ObjectType({
  elemID: new ElemID(JIRA, VALIDATOR_CONFIGURATION),
  fields: {
    comparator: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    date1: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    date2: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    expression: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    includeTime: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    windowsDays: {
      refType: BuiltinTypes.NUMBER,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    ignoreContext: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    errorMessage: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    fieldIds: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    fieldId: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    exemptedGroups: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    excludeSubtasks: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    parentStatuses: {
      refType: new ListType(statusRef),
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    permissionKey: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    mostRecentStatusOnly: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    previousStatus: { refType: statusRef, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    nullAllowed: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    FIELD_FORM_FIELD: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    FIELD_TEXT_FIELD: {
      refType: BuiltinTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    username: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    FIELD_FIELD_IDS: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    FIELD_REQUIRED_FIELDS: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
    FIELD_USER_IN_FIELDS: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
  },
  path: [JIRA, elements.TYPES_PATH, VALIDATOR_CONFIGURATION],
})

export const validatorType = new ObjectType({
  elemID: new ElemID(JIRA, 'Validator'),
  fields: {
    type: { refType: BuiltinTypes.STRING },
    configuration: { refType: validatorConfigurationType },
  },
  path: [JIRA, elements.TYPES_PATH, 'Validator'],
})

export const types = [statusRef, validatorConfigurationType, validatorType]
