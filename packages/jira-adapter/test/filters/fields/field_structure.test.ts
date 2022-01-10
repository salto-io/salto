/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { mockClient } from '../../utils'
import { DEFAULT_CONFIG } from '../../../src/config'
import { JIRA } from '../../../src/constants'
import fieldsStructureFilter from '../../../src/filters/fields/field_structure'

describe('fields_structure', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldType: ObjectType
  beforeEach(() => {
    const { client, paginator } = mockClient()
    filter = fieldsStructureFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, 'Field'),
    })
  })
  it('should replace schema.custom with type', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        schema: {
          custom: 'someType',
        },
      }
    )
    await filter.onFetch([instance])
    expect(instance.value).toEqual({ type: 'someType' })
  })

  it('should add the defaults, issue types and projects to the contexts', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        contexts: [
          {
            name: 'name',
            id: 'id1',
          },
        ],
        contextDefaults: [
          {
            contextId: 'id1',
            value: 'someValue',
          },
        ],
        contextIssueTypes: [
          {
            contextId: 'id1',
            issueTypeId: '1',
          },
          {
            contextId: 'id1',
            issueTypeId: '2',
          },
        ],
        contextProjects: [
          {
            contextId: 'id1',
            projectId: '3',
          },
          {
            contextId: 'id1',
            projectId: '4',
          },
        ],
      }
    )
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      contexts: {
        name: {
          name: 'name',
          id: 'id1',
          defaultValue: {
            value: 'someValue',
          },
          issueTypeIds: ['1', '2'],
          projectIds: ['3', '4'],
        },
      },
    })
  })

  it('should transform options to map and add postions and cascadingOptions', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        contexts: [
          {
            name: 'name',
            id: 'id1',
            options: [
              {
                id: '1',
                value: 'someValue',
              },
              {
                id: '2',
                value: 'someValue2',
              },
              {
                id: '3',
                value: 'someValue3',
                optionId: '1',
              },
              {
                id: '4',
                value: 'someValue4',
                optionId: '1',
              },
              {
                id: '5',
                value: 'someValue5',
                optionId: '2',
              },
              {
                id: '6',
                value: 'someValue6',
                optionId: '2',
              },
            ],
          },
        ],
      }
    )
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      contexts: {
        name: {
          name: 'name',
          id: 'id1',
          options: {
            someValue: {
              id: '1',
              value: 'someValue',
              position: 0,
              cascadingOptions: {
                someValue3: {
                  id: '3',
                  value: 'someValue3',
                  position: 0,
                },
                someValue4: {
                  id: '4',
                  value: 'someValue4',
                  position: 1,
                },
              },
            },
            someValue2: {
              id: '2',
              value: 'someValue2',
              position: 1,
              cascadingOptions: {
                someValue5: {
                  id: '5',
                  value: 'someValue5',
                  position: 0,
                },
                someValue6: {
                  id: '6',
                  value: 'someValue6',
                  position: 1,
                },
              },
            },
          },
        },
      },
    })
  })

  it('should add the new fields to the Field type', async () => {
    const fieldContextType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
    const fieldContextDefaultValueType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContextDefaultValue') })
    const fieldContextOptionType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContextOption') })

    fieldType.fields.contextDefaults = new Field(fieldType, 'contextDefaults', BuiltinTypes.STRING)
    fieldType.fields.contextProjects = new Field(fieldType, 'contextProjects', BuiltinTypes.STRING)
    fieldType.fields.contextIssueTypes = new Field(fieldType, 'contextIssueTypes', BuiltinTypes.STRING)

    await filter.onFetch([
      fieldType,
      fieldContextType,
      fieldContextDefaultValueType,
      fieldContextOptionType,
    ])

    expect(fieldType.fields.contextDefaults).toBeUndefined()
    expect(fieldType.fields.contextProjects).toBeUndefined()
    expect(fieldType.fields.contextIssueTypes).toBeUndefined()

    expect(fieldContextType.fields.projectIds).toBeDefined()
    expect(fieldContextType.fields.issueTypeIds).toBeDefined()
    expect(fieldContextType.fields.defaultValue).toBeDefined()
    expect(fieldContextType.fields.options).toBeDefined()

    expect(fieldContextOptionType.fields.position).toBeDefined()
  })
})
