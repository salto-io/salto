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

import { InstanceElement, toChange, DependencyChange, ElemID, ObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { MFA_POLICY_TYPE_NAME, OKTA } from '../../src/constants'
import { defaultMultifactorEnrollmentPolicyDependency } from '../../src/dependency_changers/default_multi_factor_enrollment_policy'

describe('defaultMultifactorEnrollmentPolicyDependency', () => {
  let dependencyChanges: DependencyChange[]
  const multifactorEnrollmentPolicyPolicyType = new ObjectType({ elemID: new ElemID(OKTA, MFA_POLICY_TYPE_NAME) })
  const multifactorEnrollmentPolicyInstnace = new InstanceElement(
    'mfaInstance',
    multifactorEnrollmentPolicyPolicyType,
    {
      id: '1',
      name: 'mfaInstance',
      system: false,
    },
  )
  const multifactorEnrollmentPolicyInstanceTwo = new InstanceElement(
    'mfaInstanceTwo',
    multifactorEnrollmentPolicyPolicyType,
    {
      id: '2',
      name: 'mfaInstanceTwo',
      system: false,
    },
  )
  const defaultMultifactorEnrollmentPolicyInstance = new InstanceElement(
    'defaultMfaInstance',
    multifactorEnrollmentPolicyPolicyType,
    {
      id: '3',
      name: 'defaultMfaInstance',
      system: true,
    },
  )
  it('should add dependencies from multifactorEnrollmentPolicy to Default multifactorEnrollmentPolicy', async () => {
    const defaultMultifactorEnrollmentPolicyInstanceAfter = defaultMultifactorEnrollmentPolicyInstance.clone()
    defaultMultifactorEnrollmentPolicyInstanceAfter.value.name = 'afterMfaInstance'
    const inputChanges = new Map([
      [
        0,
        toChange({
          before: defaultMultifactorEnrollmentPolicyInstance,
          after: defaultMultifactorEnrollmentPolicyInstanceAfter,
        }),
      ],
      [1, toChange({ after: multifactorEnrollmentPolicyInstnace })],
      [2, toChange({ before: multifactorEnrollmentPolicyInstanceTwo })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
    dependencyChanges = [...(await defaultMultifactorEnrollmentPolicyDependency(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)
    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(0)
    expect(dependencyChanges[1].dependency.target).toEqual(2)
  })
  it('should not add dependencies if there is no default multifactorEnrollmentPolicy', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: multifactorEnrollmentPolicyInstnace })],
      [1, toChange({ before: multifactorEnrollmentPolicyInstanceTwo })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
    dependencyChanges = [...(await defaultMultifactorEnrollmentPolicyDependency(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
