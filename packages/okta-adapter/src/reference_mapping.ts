/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { APPLICATION_TYPE_NAME, GROUP_TYPE_NAME, IDENTITY_PROVIDER_TYPE_NAME, USERTYPE_TYPE_NAME, FEATURE_TYPE_NAME, NETWORK_ZONE_TYPE_NAME, ROLE_TYPE_NAME, ACCESS_POLICY_TYPE_NAME, PROFILE_ENROLLMENT_POLICY_TYPE_NAME, INLINE_HOOK_TYPE_NAME, AUTHENTICATOR_TYPE_NAME, BEHAVIOR_RULE_TYPE_NAME, USER_SCHEMA_TYPE_NAME, ROLE_ASSIGNMENT_TYPE_NAME, BRAND_TYPE_NAME } from './constants'
import { resolveUserSchemaRef } from './filters/expression_language'

const { awu } = collections.asynciterable

export const OktaMissingReferenceStrategyLookup: Record<
referenceUtils.MissingReferenceStrategyName, referenceUtils.MissingReferenceStrategy
> = {
  typeAndValue: {
    create: ({ value, adapter, typeName }) => {
      if (!_.isString(typeName) || !value) {
        return undefined
      }
      return referenceUtils.createMissingInstance(adapter, typeName, value)
    },
  },
}

type OktaReferenceSerializationStrategyName = 'key'
const OktaReferenceSerializationStrategyLookup: Record<
  OktaReferenceSerializationStrategyName | referenceUtils.ReferenceSerializationStrategyName,
  referenceUtils.ReferenceSerializationStrategy
> = {
  ...referenceUtils.ReferenceSerializationStrategyLookup,
  key: {
    serialize: ({ ref }) => ref.value.value.key,
    lookup: val => val,
    lookupIndexName: 'key',
  },
}

const getProfileMappingRefType: referenceUtils.ContextValueMapperFunc = val => {
  if (val === 'user') {
    return USERTYPE_TYPE_NAME
  }
  if (val === 'appuser') {
    return APPLICATION_TYPE_NAME
  }
  return undefined
}

export type ReferenceContextStrategyName = 'neighborField'

export const contextStrategyLookup: Record<ReferenceContextStrategyName, referenceUtils.ContextFunc> = {
  neighborField: referenceUtils.neighborContextGetter({ contextFieldName: 'type', getLookUpName: async ({ ref }) => ref.elemID.name, contextValueMapper: getProfileMappingRefType }),
}

type OktaFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<ReferenceContextStrategyName> & {
  oktaSerializationStrategy?: OktaReferenceSerializationStrategyName
  oktaMissingRefStrategy?: referenceUtils.MissingReferenceStrategyName
}

export class OktaFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<ReferenceContextStrategyName> {
  constructor(def: OktaFieldReferenceDefinition) {
    super({ ...def, sourceTransformation: def.sourceTransformation ?? 'asString' })
    this.serializationStrategy = OktaReferenceSerializationStrategyLookup[
      def.oktaSerializationStrategy ?? def.serializationStrategy ?? 'fullValue'
    ]
    this.missingRefStrategy = def.oktaMissingRefStrategy
      ? OktaMissingReferenceStrategyLookup[def.oktaMissingRefStrategy]
      : undefined
  }
}

export const referencesRules: OktaFieldReferenceDefinition[] = [
  {
    src: { field: 'assignedGroups', parentTypes: [APPLICATION_TYPE_NAME] },
    serializationStrategy: 'id',
    oktaMissingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'role', parentTypes: [ROLE_ASSIGNMENT_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: ROLE_TYPE_NAME },
  },
  {
    src: { field: 'type', parentTypes: [ROLE_ASSIGNMENT_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: ROLE_TYPE_NAME },
  },
  {
    src: { field: 'resource-set', parentTypes: [ROLE_ASSIGNMENT_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: 'ResourceSet' },
  },
  {
    src: { field: 'featureDependencies', parentTypes: [FEATURE_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: FEATURE_TYPE_NAME },
  },
  {
    src: { field: 'groupIds', parentTypes: ['GroupRuleGroupAssignment'] },
    serializationStrategy: 'id',
    oktaMissingRefStrategy: 'typeAndValue',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'include', parentTypes: ['UserTypeCondition'] },
    serializationStrategy: 'id',
    oktaMissingRefStrategy: 'typeAndValue',
    target: { type: USERTYPE_TYPE_NAME },
  },
  {
    src: { field: 'exclude', parentTypes: ['UserTypeCondition'] },
    serializationStrategy: 'id',
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
    target: { type: IDENTITY_PROVIDER_TYPE_NAME },
  },
  {
    src: { field: 'profileEnrollment', parentTypes: [APPLICATION_TYPE_NAME] },
    serializationStrategy: 'id',
    oktaMissingRefStrategy: 'typeAndValue',
    target: { type: PROFILE_ENROLLMENT_POLICY_TYPE_NAME },
  },
  {
    src: { field: 'accessPolicy', parentTypes: [APPLICATION_TYPE_NAME] },
    serializationStrategy: 'id',
    oktaMissingRefStrategy: 'typeAndValue',
    target: { type: ACCESS_POLICY_TYPE_NAME },
  },
  {
    src: { field: 'targetGroupIds', parentTypes: ['ProfileEnrollmentPolicyRuleAction'] },
    serializationStrategy: 'id',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'inlineHookId', parentTypes: ['PreRegistrationInlineHook'] },
    serializationStrategy: 'id',
    target: { type: INLINE_HOOK_TYPE_NAME },
  },
  {
    src: { field: 'key', parentTypes: ['MultifactorEnrollmentPolicyAuthenticatorSettings'] },
    oktaSerializationStrategy: 'key',
    target: { type: AUTHENTICATOR_TYPE_NAME },
  },
  {
    src: { field: 'behaviors', parentTypes: ['RiskPolicyRuleCondition'] },
    serializationStrategy: 'id',
    target: { type: BEHAVIOR_RULE_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['AppAndInstanceConditionEvaluatorAppOrInstance'] },
    serializationStrategy: 'id',
    oktaMissingRefStrategy: 'typeAndValue',
    target: { type: APPLICATION_TYPE_NAME },
  },
  {
    src: { field: 'enabledGroup', parentTypes: ['BrowserPlugin'] },
    serializationStrategy: 'id',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['ProfileMappingSource'] },
    serializationStrategy: 'id',
    target: { typeContext: 'neighborField' },
  },
  {
    src: { field: 'appInstanceId', parentTypes: ['AuthenticatorSettings'] },
    serializationStrategy: 'id',
    target: { type: APPLICATION_TYPE_NAME },
  },
  {
    src: { field: 'id', parentTypes: ['Group__source'] },
    serializationStrategy: 'id',
    target: { type: APPLICATION_TYPE_NAME },
  },
  { src: { field: 'include', parentTypes: ['DeviceCondition'] },
    serializationStrategy: 'id',
    target: { type: 'DeviceAssurance' } },
  {
    src: { field: 'emailDomainId', parentTypes: ['Brand'] },
    serializationStrategy: 'id',
    target: { type: 'EmailDomain' },
  },
  {
    src: { field: 'appInstanceId', parentTypes: ['DefaultApp'] },
    serializationStrategy: 'id',
    target: { type: APPLICATION_TYPE_NAME },
  },
  {
    src: { field: 'brandId', parentTypes: ['Domain'] },
    serializationStrategy: 'id',
    target: { type: BRAND_TYPE_NAME },
  },
]

// Resolve references to userSchema fields references to field name instead of full value
const userSchemaLookUpFunc: GetLookupNameFunc = async ({ ref }) => {
  if (ref.elemID.typeName !== USER_SCHEMA_TYPE_NAME) {
    return ref
  }
  const userSchemaField = resolveUserSchemaRef(ref)
  return userSchemaField ?? ref
}

const lookupNameFuncs: GetLookupNameFunc[] = [
  userSchemaLookUpFunc,
  // The second param is needed to resolve references by oktaSerializationStrategy
  referenceUtils.generateLookupFunc(referencesRules, defs => new OktaFieldReferenceResolver(defs)),
]

export const getLookUpName: GetLookupNameFunc = async args => (
  awu(lookupNameFuncs)
    .map(lookupFunc => lookupFunc(args))
    .find(res => !isReferenceExpression(res))
)
