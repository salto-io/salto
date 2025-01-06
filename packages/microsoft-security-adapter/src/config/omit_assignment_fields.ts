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

const OMIT_ASSIGNMENT_STRATEGIES = ['omit', 'fallback'] as const
type OmitAssignmentStrategy = (typeof OMIT_ASSIGNMENT_STRATEGIES)[number]

export type ConditionalAccessPolicyAssignmentField =
  (typeof entraConstants.CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS)[number]

export type OmitAssignmentFieldRule =
  | {
      strategy: Exclude<OmitAssignmentStrategy, 'fallback'>
    }
  | {
      strategy: Extract<OmitAssignmentStrategy, 'fallback'>
      fallbackValue: unknown
    }

export type OmitConditionalAccessPolicyAssignmentFieldsConfig = Partial<
  Record<ConditionalAccessPolicyAssignmentField, OmitAssignmentFieldRule>
>

export type OmitAssignmentFieldsConfig = {
  EntraConditionalAccessPolicy?: OmitConditionalAccessPolicyAssignmentFieldsConfig
  Intune?: string[]
}

export const omitAssignmentFieldRuleType = createMatchingObjectType<OmitAssignmentFieldRule>({
  elemID: new ElemID(ADAPTER_NAME, 'OmitAssignmentFieldRule'),
  fields: {
    strategy: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: OMIT_ASSIGNMENT_STRATEGIES }),
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

export const omitConditionalAccessPolicyAssignmentFieldsType =
  createMatchingObjectType<OmitConditionalAccessPolicyAssignmentFieldsConfig>({
    elemID: new ElemID(ADAPTER_NAME, 'ConditionalAccessPolicyAssignmentFieldsConfig'),
    fields: Object.fromEntries(
      entraConstants.CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS.map(field => [
        field,
        {
          refType: omitAssignmentFieldRuleType,
          annotations: {
            _required: false,
          },
        },
      ]),
    ) as Record<ConditionalAccessPolicyAssignmentField, { refType: ObjectType; annotations: { _required: false } }>,
  })

export const omitAssignmentFieldsConfigType = createMatchingObjectType<OmitAssignmentFieldsConfig>({
  elemID: new ElemID(ADAPTER_NAME, 'OmitAssignmentConfig'),
  fields: {
    EntraConditionalAccessPolicy: {
      refType: omitConditionalAccessPolicyAssignmentFieldsType,
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

export const OMIT_ASSIGNMENT_FIELDS_CONFIG_FIELD_NAME = 'omitAssignmentFields'
