/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isReferenceExpression } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc, naclCase } from '@salto-io/adapter-utils'
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
  JWK_TYPE_NAME,
  USER_ROLES_TYPE_NAME,
} from './constants'
import { resolveUserSchemaRef } from './filters/expression_language'

const { awu } = collections.asynciterable

type OktaReferenceSerializationStrategyName =
  | 'key'
  | 'mappingRuleId'
  | 'kid'
  | 'credentials.oauthClient.client_id'
  | 'emailDomainId'
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
  kid: {
    serialize: ({ ref }) => ref.value.value.kid,
    lookup: val => val,
    lookupIndexName: 'kid',
  },
  'credentials.oauthClient.client_id': {
    lookup: val => val,
    lookupIndexName: 'credentials.oauthClient.client_id',
    getReferenceId: topLevelId => topLevelId.createNestedID('credentials', 'oauthClient', 'client_id'),
  },
  // When adding an email domain alongside the brand that uses it, we reverse the dependencies to create the brand
  // first, then the email domain. This is because Okta requires the brand ID to be added to the email domain request.
  // This means we can't use the `id` strategy since it serializes the reference in deployments using its `id` field,
  // which isn't available. In which case it would be set as undefined, making the restore logic omit it from the
  // brand instance, removing the field altogether.
  // Instead, we use a strategy that's almost identical to `id`, except when it isn't available, we arbitrarily
  // serialize it as the entire instance element - though it could be anything that isn't a string -  so that the brand
  // deploy request can ignore any non-string serialized values.
  emailDomainId: {
    serialize: ({ ref }) => ref.value?.value?.id ?? ref.value,
    lookup: val => val,
    lookupIndexName: 'id',
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

const getUserSchemaPropertyOverrideType: referenceUtils.ContextValueMapperFunc = val =>
  val === 'APP' ? APPLICATION_TYPE_NAME : undefined

type ReferenceContextStrategyName = 'profileMappingType' | 'profileMappingName' | 'userSchemaPropertyAppOverride'

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
  userSchemaPropertyAppOverride: referenceUtils.neighborContextGetter({
    contextFieldName: 'type',
    getLookUpName: async ({ ref }) => ref.elemID.name,
    contextValueMapper: getUserSchemaPropertyOverrideType,
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
    src: { field: 'include', parentTypes: ['GroupCondition', 'PolicyAccountLinkFilterGroups'] },
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
    serializationStrategy: 'emailDomainId',
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
    src: { field: 'value', parentTypes: ['UserSchemaAttributeMasterPriority'] },
    serializationStrategy: 'id',
    target: { typeContext: 'userSchemaPropertyAppOverride' },
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
  {
    src: { field: 'assignments', parentTypes: ['ProvisioningGroups'] },
    serializationStrategy: 'id',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'kid', parentTypes: ['IdentityProviderCredentialsTrust'] },
    serializationStrategy: 'kid',
    target: { type: JWK_TYPE_NAME },
  },
  {
    src: { field: 'scopes', parentTypes: ['OAuth2ClaimConditions'] },
    serializationStrategy: 'name',
    target: { type: 'OAuth2Scope' },
  },
  {
    src: { field: 'include', parentTypes: ['OAuth2ScopesMediationPolicyRuleCondition'] },
    serializationStrategy: 'name',
    target: { type: 'OAuth2Scope' },
  },
  {
    src: { field: 'include', parentTypes: ['ClientPolicyCondition'] },
    serializationStrategy: 'credentials.oauthClient.client_id',
    target: { type: APPLICATION_TYPE_NAME },
  },
  {
    src: { field: 'role', parentTypes: ['UserRole'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'Role' },
  },
  {
    src: { field: naclCase('resource-set'), parentTypes: ['UserRole'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: 'ResourceSet' },
  },
  {
    src: { field: 'excludeZones', parentTypes: ['ThreatInsightConfiguration'] },
    serializationStrategy: 'id',
    missingRefStrategy: 'typeAndValue',
    target: { type: NETWORK_ZONE_TYPE_NAME },
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
  {
    src: { field: 'user', parentTypes: [USER_ROLES_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: USER_TYPE_NAME },
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
