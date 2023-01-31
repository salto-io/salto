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
import { toChange, ObjectType, ElemID, InstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { workflowSchemeDupsValidator } from '../../../src/change_validators/workflows/workflow_scheme_dups'
import { JIRA, WORKFLOW_SCHEME_TYPE_NAME } from '../../../src/constants'

describe('workflowSchemeDupsValidator', () => {
  let type: ObjectType
  let instance1: InstanceElement
  let instance2: InstanceElement
  let elementSource: ReadOnlyElementsSource

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_SCHEME_TYPE_NAME) })
    instance1 = new InstanceElement(
      'instance1',
      type,
      {
        name: 'name1',
      }
    )

    instance2 = new InstanceElement(
      'instance2',
      type,
      {
        name: 'name2',
      }
    )

    elementSource = buildElementsSourceFromElements([instance1, instance2])
  })
  it('should return an error if instance name is not unique', async () => {
    instance1.value.name = 'name2'
    expect(await workflowSchemeDupsValidator(
      [
        toChange({
          after: instance1,
        }),
      ],
      elementSource,
    )).toEqual([
      {
        elemID: instance1.elemID,
        severity: 'Error',
        message: 'Workflow scheme names must be unique',
        detailedMessage: 'A workflow scheme with the name "name2" already exists (the name is case insensitive)',
      },
    ])
  })

  it('should return an error if instance name is not unique with different case', async () => {
    instance1.value.name = 'NaMe2'
    expect(await workflowSchemeDupsValidator(
      [
        toChange({
          after: instance1,
        }),
      ],
      elementSource,
    )).toEqual([
      {
        elemID: instance1.elemID,
        severity: 'Error',
        message: 'Workflow scheme names must be unique',
        detailedMessage: 'A workflow scheme with the name "NaMe2" already exists (the name is case insensitive)',
      },
    ])
  })

  it('should do nothing if element source is not passed', async () => {
    instance1.value.name = 'name2'
    expect(await workflowSchemeDupsValidator(
      [
        toChange({
          after: instance1,
        }),
      ],
    )).toEqual([])
  })

  it('should not return an error if instance name is unique', async () => {
    expect(await workflowSchemeDupsValidator(
      [
        toChange({
          after: instance1,
        }),
      ],
      elementSource,
    )).toEqual([])
  })

  it('should do nothing if workflow scheme does not have a name', async () => {
    delete instance1.value.name
    expect(await workflowSchemeDupsValidator(
      [
        toChange({
          after: instance1,
        }),
      ],
      elementSource,
    )).toEqual([])
  })
})
