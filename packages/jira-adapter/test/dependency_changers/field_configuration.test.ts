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
import { ObjectType, InstanceElement, ElemID, toChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { fieldConfigurationDependencyChanger } from '../../src/dependency_changers/field_configuration'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../src/constants'
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'

describe('fieldConfigurationDependencyChanger', () => {
  let fieldType: ObjectType
  let fieldInstance: InstanceElement

  let fieldConfigurationType: ObjectType
  let fieldConfigurationInstance: InstanceElement

  beforeEach(() => {
    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
    })
    fieldInstance = new InstanceElement('fieldInst', fieldType)
    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME),
    })
    fieldConfigurationInstance = new InstanceElement('fieldConfigInst', fieldConfigurationType, {
      fields: {
        [fieldInstance.elemID.name]: {
          required: true,
        },
      },
    })
  })
  it('should add a dependency between the field config and the field on field addition', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: fieldInstance })],
      [1, toChange({ after: fieldConfigurationInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await fieldConfigurationDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(1)
    expect(dependencyChanges[0].dependency.target).toEqual(0)
  })

  it('should add a dependency between the field and the field config on field removal', async () => {
    const inputChanges = new Map([
      [0, toChange({ before: fieldInstance })],
      [1, toChange({ after: fieldConfigurationInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await fieldConfigurationDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)
  })

  it('should do nothing if field configuration does not have fields', async () => {
    delete fieldConfigurationInstance.value.fields
    const inputChanges = new Map([
      [0, toChange({ after: fieldInstance })],
      [1, toChange({ after: fieldConfigurationInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await fieldConfigurationDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
