/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ from 'lodash'
import { isReferenceExpression } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import {
  APPLICATION_TYPE_NAME,
  GROUP_TYPE_NAME,
  IDENTITY_PROVIDER_TYPE_NAME,
  USERTYPE_TYPE_NAME,
  NETWORK_ZONE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  INLINE_HOOK_TYPE_NAME,
  AUTHENTICATOR_TYPE_NAME,
  BEHAVIOR_RULE_TYPE_NAME,
  USER_SCHEMA_TYPE_NAME,
  BRAND_TYPE_NAME,
  GROUP_PUSH_TYPE_NAME,
  GROUP_PUSH_RULE_TYPE_NAME,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  USER_TYPE_NAME,
  GROUP_MEMBERSHIP_TYPE_NAME,
} from './constants'
import { resolveUserSchemaRef } from './filters/expression_language'

const { awu } = collections.asynciterable

type OktaReferenceSerializationStrategyName = 'key' | 'mappingRuleId'
type OktaReferenceIndexName = OktaReferenceSerializationStrategyName
const OktaReferenceSerializationStrategyLookup: Record<
  OktaReferenceSerializationStrategyName | referenceUtils.ReferenceSerializationStrategyName,
  referenceUtils.ReferenceSerializationStrategy<OktaReferenceIndexName>
> = {
  ...referenceUtils.ReferenceSerializationStrategyLookup,
  key: {
    serialize: ({ ref }) => ref.value.value.key,
    lookup: val => val,
    lookupIndexName: 'key',
  },
  mappingRuleId: {
    serialize: ({ ref }) => ref.value.value.mappingRuleId,
    lookup: val => val,
    lookupIndexName: 'mappingRuleId',
  },
}

const getProfileMappingRefByType: referenceUtils.ContextValueMapperFunc = val => {
  if (val === 'user') {
    return USERTYPE_TYPE_NAME
  }
  if (val === 'appuser') {
    return APPLICATION_TYPE_NAME
  }
  return undefined
}

const getProfileMappingRefByName: referenceUtils.ContextValueMapperFunc = val =>
  val.endsWith('_idp') ? IDENTITY_PROVIDER_TYPE_NAME : undefined

export type ReferenceContextStrategyName = 'profileMappingType' | 'profileMappingName'

export const contextStrategyLookup: Record<ReferenceContextStrategyName, referenceUtils.ContextFunc> = {
  profileMappingType: referenceUtils.neighborContextGetter({
    contextFieldName: 'type',
    getLookUpName: async ({ ref }) => ref.elemID.name,
    contextValueMapper: getProfileMappingRefByType,
  }),
  profileMappingName: referenceUtils.neighborContextGetter({
    contextFieldName: 'name',
    getLookUpName: async ({ ref }) => ref.elemID.name,
    contextValueMapper: getProfileMappingRefByName,
  }),
}

type OktaFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategyName,
  OktaReferenceSerializationStrategyName
>

export class OktaFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<
  ReferenceContextStrategyName,
  OktaReferenceSerializationStrategyName,
  OktaReferenceIndexName
> {
  constructor(def: OktaFieldReferenceDefinition) {
    super(
      { ...def, sourceTransformation: def.sourceTransformation ?? 'asString' },
      OktaReferenceSerializationStrategyLookup,
    )
  }
}

const referencesRules: OktaFieldReferenceDefinition[] = [
  {
    src: { field: 'id', parentTypes: [APP_GROUP_ASSIGNMENT_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'groupIds', parentTypes: ['GroupRuleGroupAssignment'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'include', parentTypes: ['UserTypeCondition'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: USERTYPE_TYPE_NAME },
  },
  {
    src: { field: 'exclude', parentTypes: ['UserTypeCondition'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: USERTYPE_TYPE_NAME },
  },
  {
    src: { field: 'include', parentTypes: ['GroupCondition'] },
    serializationStrategy: 'id',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'exclude', parentTypes: ['GroupCondition'] },
    serializationStrategy: 'id',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'include', parentTypes: ['PolicyNetworkCondition'] },
    serializationStrategy: 'id',
    target: { type: NETWORK_ZONE_TYPE_NAME },
  },
  {
    src: { field: 'exclude', parentTypes: ['PolicyNetworkCondition'] },
    serializationStrategy: 'id',
    target: { type: NETWORK_ZONE_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['IdpPolicyRuleActionProvider'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: IDENTITY_PROVIDER_TYPE_NAME },
  },
  {
    src: { field: 'profileEnrollment', parentTypes: [APPLICATION_TYPE_NAME] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: PROFILE_ENROLLMENT_POLICY_TYPE_NAME },
  },
  {
    src: { field: 'accessPolicy', parentTypes: [APPLICATION_TYPE_NAME] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: ACCESS_POLICY_TYPE_NAME },
  },
  {
    src: { field: 'targetGroupIds', parentTypes: ['ProfileEnrollmentPolicyRuleAction'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'inlineHookId', parentTypes: ['PreRegistrationInlineHook'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: INLINE_HOOK_TYPE_NAME },
  },
  {
    src: { field: 'key', parentTypes: ['MultifactorEnrollmentPolicyAuthenticatorSettings'] },
    serializationStrategy: 'key',
    missingRefStrategy: 'typeAndValue',
    target: { type: AUTHENTICATOR_TYPE_NAME },
  },
  {
    src: { field: 'behaviors', parentTypes: ['RiskPolicyRuleCondition'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: BEHAVIOR_RULE_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['AppAndInstanceConditionEvaluatorAppOrInstance'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: APPLICATION_TYPE_NAME },
  },
  {
    src: { field: 'enabledGroup', parentTypes: ['BrowserPlugin'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['ProfileMappingSource'] },
    serializationStrategy: 'id',
    target: { typeContext: 'profileMappingType' },
  },
  {
    src: { field: 'id', parentTypes: ['ProfileMappingSource'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { typeContext: 'profileMappingName' },
  },
  {
    src: { field: 'appInstanceId', parentTypes: ['AuthenticatorSettings'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: APPLICATION_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['Group__source'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: APPLICATION_TYPE_NAME },
  },
  {
    src: { field: 'include', parentTypes: ['DeviceCondition'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'DeviceAssurance' },
  },
  {
    src: { field: 'emailDomainId', parentTypes: ['Brand'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'EmailDomain' },
  },
  {
    src: { field: 'appInstanceId', parentTypes: ['DefaultApp'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: APPLICATION_TYPE_NAME },
  },
  {
    src: { field: 'brandId', parentTypes: ['Domain'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: BRAND_TYPE_NAME },
  },
  {
    src: { field: 'userGroupId', parentTypes: [GROUP_PUSH_TYPE_NAME] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'groupPushRule', parentTypes: [GROUP_PUSH_TYPE_NAME] },
    serializationStrategy: 'mappingRuleId',
    missingRefStrategy: 'typeAndValue',
    target: { type: GROUP_PUSH_RULE_TYPE_NAME },
  },
]

const userReferenceRules: OktaFieldReferenceDefinition[] = [
  {
    src: { field: 'exclude', parentTypes: ['UserCondition', 'GroupRuleUserCondition'] },
    serializationStrategy: 'id',
    target: { type: USER_TYPE_NAME },
  },
  {
    src: { field: 'include', parentTypes: ['UserCondition'] },
    serializationStrategy: 'id',
    target: { type: USER_TYPE_NAME },
  },
  {
    src: { field: 'members', parentTypes: [GROUP_MEMBERSHIP_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: USER_TYPE_NAME },
  },
  {
    src: { field: 'technicalContactId', parentTypes: ['EndUserSupport'] },
    serializationStrategy: 'id',
    target: { type: USER_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['UserTypeRef'] },
    serializationStrategy: 'id',
    target: { type: USERTYPE_TYPE_NAME },
  },
]

export const getReferenceDefs = ({
  enableMissingReferences,
  isUserTypeIncluded,
}: {
  enableMissingReferences?: boolean
  isUserTypeIncluded: boolean
}): OktaFieldReferenceDefinition[] =>
  referencesRules
    .concat(isUserTypeIncluded ? userReferenceRules : [])
    .map(def => (enableMissingReferences ? def : _.omit(def, 'missingRefStrategy')))

// Resolve references to userSchema fields references to field name instead of full value
const userSchemaLookUpFunc: GetLookupNameFunc = async ({ ref }) => {
  if (ref.elemID.typeName !== USER_SCHEMA_TYPE_NAME) {
    return ref
  }
  const userSchemaField = resolveUserSchemaRef(ref)
  return userSchemaField ?? ref
}

export const getLookUpNameCreator = ({
  enableMissingReferences,
  isUserTypeIncluded,
}: {
  enableMissingReferences?: boolean
  isUserTypeIncluded: boolean
}): GetLookupNameFunc => {
  const rules = getReferenceDefs({ enableMissingReferences, isUserTypeIncluded })
  const lookupNameFuncs = [
    userSchemaLookUpFunc,
    // The second param is needed to resolve references by serializationStrategy
    referenceUtils.generateLookupFunc(rules, defs => new OktaFieldReferenceResolver(defs)),
  ]
  return async args =>
    awu(lookupNameFuncs)
      .map(lookupFunc => lookupFunc(args))
      .find(res => !isReferenceExpression(res))
}
