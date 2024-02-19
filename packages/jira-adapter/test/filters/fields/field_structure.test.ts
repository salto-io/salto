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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams, mockClient } from '../../utils'
import { JIRA } from '../../../src/constants'
import fieldsStructureFilter from '../../../src/filters/fields/field_structure_filter'

describe('fields_structure', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldType: ObjectType
  let fieldContextType: ObjectType
  let fieldContextDefaultValueType: ObjectType
  let fieldContextOptionType: ObjectType
  beforeEach(() => {
    const { client, paginator } = mockClient()
    filter = fieldsStructureFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, 'Field'),
    })

    fieldContextType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
    fieldContextDefaultValueType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContextDefaultValue') })
    fieldContextOptionType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContextOption') })
  })
  it('should replace schema.custom with type', async () => {
    const instance = new InstanceElement('instance', fieldType, {
      schema: {
        custom: 'someType',
      },
    })
    await filter.onFetch([instance, fieldType, fieldContextType, fieldContextDefaultValueType, fieldContextOptionType])
    expect(instance.value).toEqual({
      type: 'someType',
    })
  })

  it('should remove isLocked if not locked', async () => {
    const instance = new InstanceElement('instance', fieldType, {
      isLocked: false,
    })
    await filter.onFetch([instance, fieldType, fieldContextType, fieldContextDefaultValueType, fieldContextOptionType])
    expect(instance.value).toEqual({})
  })

  it('should not remove isLocked if locked', async () => {
    const instance = new InstanceElement('instance', fieldType, {
      isLocked: true,
    })
    await filter.onFetch([instance, fieldType, fieldContextType, fieldContextDefaultValueType, fieldContextOptionType])
    expect(instance.value).toEqual({
      isLocked: true,
    })
  })

  it('should add the defaults, issue types and projects to the contexts', async () => {
    const instance = new InstanceElement('instance', fieldType, {
      name: 'name',
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
        {
          contextId: 'id2',
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
        {
          contextId: 'id2',
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
        {
          contextId: 'id2',
          projectId: '4',
        },
      ],
    })
    const elements = [instance, fieldType, fieldContextType, fieldContextDefaultValueType, fieldContextOptionType]
    await filter.onFetch(elements)
    const fieldInstance = elements[0] as InstanceElement
    const contextInstance = elements[elements.length - 1] as InstanceElement
    expect(fieldInstance.value).toEqual({
      name: 'name',
    })
    expect(contextInstance.value).toEqual({
      name: 'name',
      id: 'id1',
      defaultValue: {
        value: 'someValue',
      },
      issueTypeIds: ['1', '2'],
      projectIds: ['3', '4'],
    })
  })

  it('should use elemIdGetter when extracting the contexts', async () => {
    const { client, paginator } = mockClient()
    filter = fieldsStructureFilter(
      getFilterParams({
        client,
        paginator,
        getElemIdFunc: () => new ElemID(JIRA, 'customName'),
      }),
    ) as typeof filter

    const instance = new InstanceElement('instance', fieldType, {
      name: 'name',
      contexts: [
        {
          name: 'name',
          id: 'id1',
        },
      ],
    })
    const elements = [instance, fieldType, fieldContextType, fieldContextDefaultValueType, fieldContextOptionType]
    await filter.onFetch(elements)
    const contextInstance = elements[elements.length - 1] as InstanceElement

    expect(contextInstance.elemID.name).toBe('customName')
  })

  it('should transform options to map and add positions and cascadingOptions', async () => {
    const instance = new InstanceElement('instance', fieldType, {
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
    })
    const elements = [instance, fieldType, fieldContextType, fieldContextOptionType, fieldContextDefaultValueType]
    await filter.onFetch(elements)
    const contextInstance = elements[elements.length - 1] as InstanceElement
    expect(contextInstance.value).toEqual({
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
    })
  })

  it('should create the right name for the context when the id was added to the field name', async () => {
    const instance = new InstanceElement('instance_123', fieldType, {
      name: 'instance',
      id: '123',
      contexts: [
        {
          name: 'name',
        },
      ],
    })
    const elements = [instance, fieldType, fieldContextType, fieldContextOptionType, fieldContextDefaultValueType]
    await filter.onFetch(elements)
    const contextInstance = elements[elements.length - 1] as InstanceElement
    expect(contextInstance.elemID.name).toBe('instance_123_name')
  })

  it('should add the new fields to the Field type', async () => {
    fieldType.fields.contextDefaults = new Field(fieldType, 'contextDefaults', BuiltinTypes.STRING)
    fieldType.fields.contextProjects = new Field(fieldType, 'contextProjects', BuiltinTypes.STRING)
    fieldType.fields.contextIssueTypes = new Field(fieldType, 'contextIssueTypes', BuiltinTypes.STRING)

    await filter.onFetch([fieldType, fieldContextType, fieldContextDefaultValueType, fieldContextOptionType])

    expect(fieldType.fields.contextDefaults).toBeUndefined()
    expect(fieldType.fields.contextProjects).toBeUndefined()
    expect(fieldType.fields.contextIssueTypes).toBeUndefined()

    expect(fieldContextType.fields.projectIds).toBeDefined()
    expect(fieldContextType.fields.issueTypeIds).toBeDefined()
    expect(fieldContextType.fields.defaultValue).toBeDefined()
    expect(fieldContextType.fields.options).toBeDefined()

    expect(fieldContextOptionType.fields.position).toBeDefined()
  })
  it('should not fail for cascading field options with no parent', async () => {
    const instance = new InstanceElement('instance', fieldType, {
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
              optionId: '100',
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
    })
    const elements = [instance, fieldType, fieldContextType, fieldContextOptionType, fieldContextDefaultValueType]
    await filter.onFetch(elements)
    const contextInstance = elements[elements.length - 1] as InstanceElement
    expect(contextInstance.value).toEqual({
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
    })
  })
})
