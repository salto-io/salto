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

import {
  Change,
  DependencyChanger,
  InstanceElement,
  dependencyChange,
  getChangeData,
  isInstanceChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { MFA_POLICY_TYPE_NAME } from '../constants'

/*
 * This dependency changer is used to add a dependency from custom MFA policies to the default MFA policy
 * This dependency is necessary to obtain the default MFA priority before deployment,
 * preventing race conditions. The default MFA policy will be deployed last.
 */
export const defaultMultifactorEnrollmentPolicyDependency: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )
  const multifactorEnrollmentPolicyInstanceChanges = instanceChanges.filter(
    change => getChangeData(change.change).elemID.typeName === MFA_POLICY_TYPE_NAME,
  )
  const [multifactorEnrollmentPolicyPolicies, defaultMfaPolicy] = _.partition(
    multifactorEnrollmentPolicyInstanceChanges,
    change => getChangeData(change.change).value.system === false,
  )
  if (_.isEmpty(multifactorEnrollmentPolicyPolicies) || defaultMfaPolicy.length !== 1) {
    return []
  }
  const defaultPolicy = defaultMfaPolicy[0]
  return multifactorEnrollmentPolicyPolicies.flatMap(multifactorEnrollmentPolicyPolicy =>
    dependencyChange('add', defaultPolicy.key, multifactorEnrollmentPolicyPolicy.key),
  )
}
