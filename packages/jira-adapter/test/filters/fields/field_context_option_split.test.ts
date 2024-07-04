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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  ObjectType,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../../src/constants'
import fieldContextOptionsSplitFilter from '../../../src/filters/fields/field_context_option_split'
import { getFilterParams, mockClient } from '../../utils'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'

describe('fieldContextOptionSplitFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldConfigurationType: ObjectType
  let fieldConfigurationItemType: ObjectType
  let contextType: ObjectType
  let optionType: ObjectType
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldContext = true

    filter = fieldContextOptionsSplitFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter

    fieldConfigurationItemType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME),
    })

    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME),
    })
    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })
    optionType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME),
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations to CustomFieldContextOption', async () => {
      await filter.onFetch([contextType, optionType])
      expect(optionType.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      })
    })

    it("should make the context's options field a list of references", async () => {
      await filter.onFetch([contextType, optionType])
      expect(contextType.fields.options).toEqual(new Field(contextType, 'options', new ListType(BuiltinTypes.STRING)))
    })

    it('should split to different instances if enabled in the config', async () => {
      const context = new InstanceElement(
        'contextName',
        contextType,
        {
          options: {
            option1: {
              value: 'option1',
              disabled: false,
              id: '1',
              position: 1,
            },
            option2: {
              value: 'option2',
              disabled: false,
              id: '2',
              position: 2,
            },
          },
        },
        ['Jira', 'Records', 'Field', 'FieldName', 'contextName'],
      )

      const elements = [contextType, optionType, context]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(5)

      const [option1, option2] = elements.slice(3) as InstanceElement[]
      expect(option1.elemID).toEqual(
        new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'contextName_option1'),
      )
      expect(option1.value).toEqual({
        value: 'option1',
        disabled: false,
        id: '1',
        contextName: 'contextName',
      })
      expect(option1.path).toEqual(['Jira', 'Records', 'Field', 'FieldName', 'contextName', 'contextName_Options'])

      expect(option2.elemID).toEqual(
        new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'contextName_option2'),
      )
      expect(option2.value).toEqual({
        value: 'option2',
        disabled: false,
        id: '2',
        contextName: 'contextName',
      })
      expect(option2.path).toEqual(['Jira', 'Records', 'Field', 'FieldName', 'contextName', 'contextName_Options'])
    })

    it('should not split to different instances if disabled in the config', async () => {
      config.fetch.splitFieldContext = false
      const context = new InstanceElement(
        'contextName',
        contextType,
        {
          options: {
            option1: {
              value: 'option1',
              disabled: false,
              id: '1',
              position: 1,
            },
            option2: {
              value: 'option2',
              disabled: false,
              id: '2',
              position: 2,
            },
          },
        },
        ['Jira', 'Records', 'Field', 'FieldName', 'contextName'],
      )

      const elements = [fieldConfigurationType, fieldConfigurationItemType, context]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(3)

      expect(context.value.options).toEqual({
        option1: {
          value: 'option1',
          disabled: false,
          id: '1',
          position: 1,
        },
        option2: {
          value: 'option2',
          disabled: false,
          id: '2',
          position: 2,
        },
      })
    })
    it('should not split if elements does not include the relevant types', async () => {
      const context = new InstanceElement(
        'contextName',
        contextType,
        {
          options: {
            option1: {
              value: 'option1',
              disabled: false,
              id: '1',
              position: 1,
            },
            option2: {
              value: 'option2',
              disabled: false,
              id: '2',
              position: 2,
            },
          },
        },
        ['Jira', 'Records', 'Field', 'FieldName', 'contextName'],
      )

      const elements1 = [contextType, context]
      await filter.onFetch(elements1)
      expect(elements1).toHaveLength(2)

      const elements2 = [optionType, context]
      await filter.onFetch(elements2)
      expect(elements2).toHaveLength(2)

      const elements3 = [context]
      await filter.onFetch(elements3)
      expect(elements3).toHaveLength(1)
    })
  })
})
