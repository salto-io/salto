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
import { isReferenceExpression } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { APPLICATION_TYPE_NAME, GROUP_TYPE_NAME, IDENTITY_PROVIDER_TYPE_NAME, USERTYPE_TYPE_NAME, FEATURE_TYPE_NAME, POLICY_TYPE_NAME, NETWORK_ZONE_TYPE_NAME, ROLE_TYPE_NAME } from './constants'


export class OktaFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<never> {
  constructor(def: referenceUtils.FieldReferenceDefinition<never>) {
    super({ ...def, sourceTransformation: def.sourceTransformation ?? 'asString' })
  }
}

export const referencesRules: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'assignedGroups', parentTypes: [APPLICATION_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'roles', parentTypes: [GROUP_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: ROLE_TYPE_NAME },
  },
  {
    src: { field: 'featureDependencies', parentTypes: [FEATURE_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: FEATURE_TYPE_NAME },
  },
  {
    src: { field: 'groupIds', parentTypes: ['GroupRuleGroupAssignment'] },
    serializationStrategy: 'id',
    target: { type: GROUP_TYPE_NAME },
  },
  {
    src: { field: 'include', parentTypes: ['UserTypePolicyRuleCondition'] },
    serializationStrategy: 'id',
    target: { type: USERTYPE_TYPE_NAME },
  },
  {
    src: { field: 'exclude', parentTypes: ['UserTypePolicyRuleCondition'] },
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
    target: { type: POLICY_TYPE_NAME },
  },
  {
    src: { field: 'accessPolicy', parentTypes: [APPLICATION_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: POLICY_TYPE_NAME },
  },
]

const lookupNameFuncs: GetLookupNameFunc[] = [
  referenceUtils.generateLookupFunc(referencesRules),
]

export const getLookUpName: GetLookupNameFunc = async args => (
  lookupNameFuncs
    .map(lookupFunc => lookupFunc(args))
    .find(res => !isReferenceExpression(res))
)
