/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { BuiltinTypes, CORE_ANNOTATIONS, createRestriction, ElemID, ObjectType } from '@salto-io/adapter-api'
import { ADAPTER_NAME, entraConstants, intuneConstants } from '../constants'

const ASSIGNMENT_FIELD_STRATEGIES = ['omit', 'fallback'] as const
type AssignmentFieldStrategy = (typeof ASSIGNMENT_FIELD_STRATEGIES)[number]

export type IntuneTypesWithAssignments = (typeof intuneConstants.TYPES_WITH_ASSIGNMENTS)[number]
export type ConditionalAccessPolicyAssignmentField =
  (typeof entraConstants.CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS)[number]

export type AssignmentFieldRuleWithoutFallback = {
  strategy: Exclude<AssignmentFieldStrategy, 'fallback'>
}
export type AssignmentFieldRuleWithFallback =
  | AssignmentFieldRuleWithoutFallback
  | {
      strategy: 'fallback'
      fallbackValue: unknown
    }

export type IntuneAssignmentFieldsConfig = Partial<
  Record<IntuneTypesWithAssignments, AssignmentFieldRuleWithoutFallback>
>
export type ConditionalAccessPolicyAssignmentFieldsConfig = Partial<
  Record<ConditionalAccessPolicyAssignmentField, AssignmentFieldRuleWithFallback>
>

export type AssignmentFieldsConfig = {
  EntraConditionalAccessPolicy?: ConditionalAccessPolicyAssignmentFieldsConfig
  Intune?: IntuneAssignmentFieldsConfig
}

export const assignmentFieldRuleWithoutFallbackType = createMatchingObjectType<AssignmentFieldRuleWithoutFallback>({
  elemID: new ElemID(ADAPTER_NAME, 'AssignmentFieldRuleWithoutFallback'),
  fields: {
    strategy: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ASSIGNMENT_FIELD_STRATEGIES.filter(strategy => strategy !== 'fallback'),
        }),
      },
    },
  },
})
export const assignmentFieldRuleWithFallbackType = createMatchingObjectType<AssignmentFieldRuleWithFallback>({
  elemID: new ElemID(ADAPTER_NAME, 'AssignmentFieldRuleWithFallback'),
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
    },
  },
})

export const conditionalAccessPolicyAssignmentFieldsConfigType =
  createMatchingObjectType<ConditionalAccessPolicyAssignmentFieldsConfig>({
    elemID: new ElemID(ADAPTER_NAME, 'ConditionalAccessPolicyAssignmentFieldsConfig'),
    fields: Object.fromEntries(
      entraConstants.CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS.map(field => [
        field,
        {
          refType: assignmentFieldRuleWithFallbackType,
        },
      ]),
    ) as Record<ConditionalAccessPolicyAssignmentField, { refType: ObjectType }>,
  })

export const intuneAssignmentFieldsConfigType = createMatchingObjectType<IntuneAssignmentFieldsConfig>({
  elemID: new ElemID(ADAPTER_NAME, 'IntuneAssignmentFieldsConfig'),
  fields: Object.fromEntries(
    intuneConstants.TYPES_WITH_ASSIGNMENTS.map(type => [
      type,
      {
        refType: assignmentFieldRuleWithoutFallbackType,
      },
    ]),
  ) as Record<IntuneTypesWithAssignments, { refType: ObjectType }>,
})

export const assignmentFieldsConfigType = createMatchingObjectType<AssignmentFieldsConfig>({
  elemID: new ElemID(ADAPTER_NAME, 'assignmentFieldsConfig'),
  fields: {
    EntraConditionalAccessPolicy: {
      refType: conditionalAccessPolicyAssignmentFieldsConfigType,
    },
    Intune: {
      refType: intuneAssignmentFieldsConfigType,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: intuneConstants.TYPES_WITH_ASSIGNMENTS }),
      },
    },
  },
})

export const ASSIGNMENT_FIELDS_STRATEGY_CONFIG_FIELD_NAME = 'assignmentFieldsStrategy'
