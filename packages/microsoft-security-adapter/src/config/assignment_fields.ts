/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { BuiltinTypes, CORE_ANNOTATIONS, createRestriction, ElemID, ListType, ObjectType } from '@salto-io/adapter-api'
import { ADAPTER_NAME, entraConstants, intuneConstants } from '../constants'

const ASSIGNMENT_FIELD_STRATEGIES = ['omit', 'fallback'] as const
type AssignmentFieldStrategy = (typeof ASSIGNMENT_FIELD_STRATEGIES)[number]

export type ConditionalAccessPolicyAssignmentField =
  (typeof entraConstants.CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS)[number]

export type AssignmentFieldRule =
  | {
      strategy: Exclude<AssignmentFieldStrategy, 'fallback'>
    }
  | {
      strategy: Extract<AssignmentFieldStrategy, 'fallback'>
      fallbackValue: unknown
    }

export type ConditionalAccessPolicyAssignmentFieldsConfig = Partial<
  Record<ConditionalAccessPolicyAssignmentField, AssignmentFieldRule>
>

export type AssignmentFieldsConfig = {
  EntraConditionalAccessPolicy?: ConditionalAccessPolicyAssignmentFieldsConfig
  Intune?: string[]
}

export const assignmentFieldRuleType = createMatchingObjectType<AssignmentFieldRule>({
  elemID: new ElemID(ADAPTER_NAME, 'AssignmentFieldRule'),
  fields: {
    strategy: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ASSIGNMENT_FIELD_STRATEGIES }),
      },
    },
    fallbackValue: {
      refType: BuiltinTypes.UNKNOWN,
      annotations: {
        _required: false,
      },
    },
  },
})

export const conditionalAccessPolicyAssignmentFieldsType =
  createMatchingObjectType<ConditionalAccessPolicyAssignmentFieldsConfig>({
    elemID: new ElemID(ADAPTER_NAME, 'ConditionalAccessPolicyAssignmentFieldsConfig'),
    fields: Object.fromEntries(
      entraConstants.CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS.map(field => [
        field,
        {
          refType: assignmentFieldRuleType,
          annotations: {
            _required: false,
          },
        },
      ]),
    ) as Record<ConditionalAccessPolicyAssignmentField, { refType: ObjectType; annotations: { _required: false } }>,
  })

export const assignmentFieldsConfigType = createMatchingObjectType<AssignmentFieldsConfig>({
  elemID: new ElemID(ADAPTER_NAME, 'assignmentFieldsConfig'),
  fields: {
    EntraConditionalAccessPolicy: {
      refType: conditionalAccessPolicyAssignmentFieldsType,
      annotations: {
        _required: false,
      },
    },
    Intune: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        _required: false,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: intuneConstants.TYPES_WITH_GROUP_ASSIGNMENTS }),
      },
    },
  },
})

export const ASSIGNMENT_FIELDS_STRATEGY_CONFIG_FIELD_NAME = 'assignmentFieldsStrategy'
