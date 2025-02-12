/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { BuiltinTypes, CORE_ANNOTATIONS, createRestriction, ElemID, ObjectType } from '@salto-io/adapter-api'
import { MICROSOFT_SECURITY, entraConstants, intuneConstants } from '../constants'

const ASSIGNMENT_FIELD_STRATEGIES = ['omit', 'fallback'] as const
type AssignmentFieldStrategy = (typeof ASSIGNMENT_FIELD_STRATEGIES)[number]

type IntuneTypesWithAssignments = (typeof intuneConstants.TYPES_WITH_ASSIGNMENTS)[number]
export type ConditionalAccessPolicyAssignmentField =
  (typeof entraConstants.CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS)[number]

type AssignmentFieldRuleWithoutFallback = {
  strategy: Exclude<AssignmentFieldStrategy, 'fallback'>
}
export type AssignmentFieldRuleWithFallback =
  | AssignmentFieldRuleWithoutFallback
  | {
      strategy: 'fallback'
      fallbackValue: unknown
    }

export type IntuneAssignmentsField = typeof intuneConstants.ASSIGNMENTS_FIELD_NAME
export type IntuneAssignmentsFieldNamesConfig = Partial<
  Record<IntuneAssignmentsField, AssignmentFieldRuleWithoutFallback>
>
export type ConditionalAccessPolicyAssignmentFieldNamesConfig = Partial<
  Record<ConditionalAccessPolicyAssignmentField, AssignmentFieldRuleWithFallback>
>

type IntuneAssignmentFieldsConfig = Partial<Record<IntuneTypesWithAssignments, IntuneAssignmentsFieldNamesConfig>>
type EntraAssignmentFieldsConfig = Partial<
  Record<
    typeof entraConstants.TOP_LEVEL_TYPES.CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
    ConditionalAccessPolicyAssignmentFieldNamesConfig
  >
>

export type AssignmentFieldsConfig = IntuneAssignmentFieldsConfig & EntraAssignmentFieldsConfig

const assignmentFieldRuleWithoutFallbackType = createMatchingObjectType<AssignmentFieldRuleWithoutFallback>({
  elemID: new ElemID(MICROSOFT_SECURITY, 'AssignmentFieldRuleWithoutFallback'),
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
const assignmentFieldRuleWithFallbackType = createMatchingObjectType<AssignmentFieldRuleWithFallback>({
  elemID: new ElemID(MICROSOFT_SECURITY, 'AssignmentFieldRuleWithFallback'),
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

const intuneAssignmentsFieldNamesConfigType = createMatchingObjectType<IntuneAssignmentsFieldNamesConfig>({
  elemID: new ElemID(MICROSOFT_SECURITY, 'IntuneAssignmentsFieldNamesConfig'),
  fields: {
    [intuneConstants.ASSIGNMENTS_FIELD_NAME]: {
      refType: assignmentFieldRuleWithoutFallbackType,
    },
  },
})
const conditionalAccessPolicyAssignmentFieldNamesConfigType =
  createMatchingObjectType<ConditionalAccessPolicyAssignmentFieldNamesConfig>({
    elemID: new ElemID(MICROSOFT_SECURITY, 'ConditionalAccessPolicyAssignmentFieldNamesConfig'),
    fields: Object.fromEntries(
      entraConstants.CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS.map(field => [
        field,
        {
          refType: assignmentFieldRuleWithFallbackType,
        },
      ]),
    ) as Record<ConditionalAccessPolicyAssignmentField, { refType: ObjectType }>,
  })

export const assignmentFieldsConfigType = createMatchingObjectType<AssignmentFieldsConfig>({
  elemID: new ElemID(MICROSOFT_SECURITY, 'assignmentFieldsConfig'),
  fields: {
    [entraConstants.TOP_LEVEL_TYPES.CONDITIONAL_ACCESS_POLICY_TYPE_NAME]: {
      refType: conditionalAccessPolicyAssignmentFieldNamesConfigType,
    },
    ...(Object.fromEntries(
      intuneConstants.TYPES_WITH_ASSIGNMENTS.map(type => [
        type,
        {
          refType: intuneAssignmentsFieldNamesConfigType,
        },
      ]),
    ) as Record<IntuneTypesWithAssignments, { refType: ObjectType }>),
  },
})

export const ASSIGNMENT_FIELDS_STRATEGY_CONFIG_FIELD_NAME = 'assignmentFieldsStrategy'
