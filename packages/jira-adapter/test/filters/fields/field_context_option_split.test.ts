/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { JIRA } from '../../../src/constants'
import fieldContextOptionsSplitFilter from '../../../src/filters/fields/field_context_option_split'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../../src/filters/fields/constants'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'

describe('fieldContextOptionSplitFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let contextType: ObjectType
  let optionType: ObjectType
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldContextOptions = true

    filter = fieldContextOptionsSplitFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter

    contextType = createEmptyType(FIELD_CONTEXT_TYPE_NAME)
    optionType = createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME)
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
    it('should add order instance type', async () => {
      const elements = [contextType, optionType]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(3)
      expect(elements[2]).toEqual(
        new ObjectType({
          elemID: new ElemID('jira', OPTIONS_ORDER_TYPE_NAME),
          fields: {
            options: {
              refType: new ListType(BuiltinTypes.STRING),
              annotations: {
                [CORE_ANNOTATIONS.CREATABLE]: true,
                [CORE_ANNOTATIONS.UPDATABLE]: true,
                [CORE_ANNOTATIONS.DELETABLE]: true,
              },
            },
          },
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: true,
            [CORE_ANNOTATIONS.UPDATABLE]: true,
            [CORE_ANNOTATIONS.DELETABLE]: true,
          },
        }),
      )
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
      expect(elements).toHaveLength(7)

      const option1 = elements.find(e => e.elemID.name === 'contextName_option1') as InstanceElement
      expect(option1).toBeDefined()
      expect(option1.value).toEqual({
        value: 'option1',
        disabled: false,
        id: '1',
      })
      expect(option1.path).toEqual(['Jira', 'Records', 'Field', 'FieldName', 'contextName', 'contextName_Options'])

      const option2 = elements.find(e => e.elemID.name === 'contextName_option2') as InstanceElement

      expect(option2.elemID).toBeDefined()
      expect(option2.value).toEqual({
        value: 'option2',
        disabled: false,
        id: '2',
      })
      expect(option2.path).toEqual(['Jira', 'Records', 'Field', 'FieldName', 'contextName', 'contextName_Options'])
      const order = elements.find(e => e.elemID.name === 'contextName_order_child') as InstanceElement
      expect(order.elemID).toBeDefined()
      expect(order.value).toEqual({
        options: [new ReferenceExpression(option1.elemID, option1), new ReferenceExpression(option2.elemID, option2)],
      })
    })

    it('should not split to different instances if disabled in the config', async () => {
      config.fetch.splitFieldContextOptions = false
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

      const elements3 = [context]
      await filter.onFetch(elements3)
      expect(elements3).toHaveLength(1)
    })
  })
  it('should handle cascading options', async () => {
    const context = new InstanceElement(
      'contextName',
      contextType,
      {
        options: {
          option1: {
            value: 'option1',
            disabled: false,
            id: '1',
            cascadingOptions: {
              cascadingOption1: {
                value: 'cascadingOption1',
                disabled: false,
                id: '3',
                position: 1,
              },
              cascadingOption2: {
                value: 'cascadingOption2',
                disabled: false,
                id: '4',
                position: 2,
              },
            },
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
    // 3 types, 1 context, 2 options, 2 cascading options, 2 orders
    expect(elements).toHaveLength(10)
    const [orderContext, orderCascade, option1, option2, cascadingOption1, cascadingOption2] = elements.slice(
      4,
    ) as InstanceElement[]

    // option1
    expect(option1.elemID).toEqual(new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'contextName_option1'))
    expect(option1.value).toEqual({
      value: 'option1',
      disabled: false,
      id: '1',
    })
    expect(option1.path).toEqual(['Jira', 'Records', 'Field', 'FieldName', 'contextName', 'contextName_Options'])

    // option2
    expect(option2.elemID).toEqual(new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'contextName_option2'))
    expect(option2.value).toEqual({
      value: 'option2',
      disabled: false,
      id: '2',
    })
    expect(option2.path).toEqual(['Jira', 'Records', 'Field', 'FieldName', 'contextName', 'contextName_Options'])

    // cascadingOption1
    expect(cascadingOption1.elemID).toEqual(
      new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'contextName_option1_cascadingOption1'),
    )
    expect(cascadingOption1.value).toEqual({
      value: 'cascadingOption1',
      disabled: false,
      id: '3',
    })

    // cascadingOption2
    expect(cascadingOption2.elemID).toEqual(
      new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'contextName_option1_cascadingOption2'),
    )
    expect(cascadingOption2.value).toEqual({
      value: 'cascadingOption2',
      disabled: false,
      id: '4',
    })

    // orderContext
    expect(orderContext.elemID).toEqual(
      new ElemID(JIRA, OPTIONS_ORDER_TYPE_NAME, 'instance', 'contextName_order_child'),
    )
    expect(orderContext.value).toEqual({
      options: [new ReferenceExpression(option1.elemID, option1), new ReferenceExpression(option2.elemID, option2)],
    })

    // orderCascade
    expect(orderCascade.elemID).toEqual(
      new ElemID(JIRA, OPTIONS_ORDER_TYPE_NAME, 'instance', 'contextName_option1_order_child'),
    )
    expect(orderCascade.value).toEqual({
      options: [
        new ReferenceExpression(cascadingOption1.elemID, cascadingOption1),
        new ReferenceExpression(cascadingOption2.elemID, cascadingOption2),
      ],
    })
  })
  describe('editDefaultValue', () => {
    it('should edit defaultValue to include references', async () => {
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
            option3: {
              value: 'option3',
              disabled: false,
              id: '3',
              position: 3,
            },
          },
          defaultValue: {
            type: 'option.multiple',
            optionIds: ['1', '3'],
          },
        },
        ['Jira', 'Records', 'Field', 'FieldName', 'contextName'],
      )
      const elements = [contextType, optionType, context]
      await filter.onFetch(elements)
      // 3 types, 1 context, 3 options, 1 orders
      expect(elements).toHaveLength(8)
      const [order, option1, option2, option3] = elements.slice(4) as InstanceElement[]
      expect(option1.elemID).toEqual(
        new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'contextName_option1'),
      )
      expect(option2.elemID).toEqual(
        new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'contextName_option2'),
      )
      expect(option3.elemID).toEqual(
        new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'contextName_option3'),
      )
      expect(order.elemID).toEqual(new ElemID(JIRA, OPTIONS_ORDER_TYPE_NAME, 'instance', 'contextName_order_child'))
      expect(context.value.defaultValue).toEqual({
        type: 'option.multiple',
        optionIds: [new ReferenceExpression(option1.elemID, option1), new ReferenceExpression(option3.elemID, option3)],
      })
    })
  })
  it('should handle cascading options in the default value', async () => {
    const context = new InstanceElement(
      'cascadeContextName',
      contextType,
      {
        options: {
          option1: {
            value: 'option1',
            disabled: false,
            id: '1',
            cascadingOptions: {
              cascadingOption1: {
                value: 'cascadingOption1',
                disabled: false,
                id: '3',
                position: 1,
              },
              cascadingOption2: {
                value: 'cascadingOption2',
                disabled: false,
                id: '4',
                position: 2,
              },
            },
            position: 1,
          },
          option2: {
            value: 'option2',
            disabled: false,
            id: '2',
            position: 2,
          },
        },
        defaultValue: {
          type: 'option.cascading',
          optionId: '1',
          cascadingOptionId: '4',
        },
      },
      ['Jira', 'Records', 'Field', 'FieldName', 'contextName'],
    )
    const elements = [contextType, optionType, context]
    await filter.onFetch(elements)
    // 3 types, 1 context, 2 options, 2 cascading options, 2 orders
    expect(elements).toHaveLength(10)
    const [orderContext, orderCascade, option1, option2, cascadingOption1, cascadingOption2] = elements.slice(
      4,
    ) as InstanceElement[]
    expect(option1.elemID).toEqual(
      new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'cascadeContextName_option1'),
    )
    expect(option2.elemID).toEqual(
      new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'cascadeContextName_option2'),
    )
    expect(cascadingOption1.elemID).toEqual(
      new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'cascadeContextName_option1_cascadingOption1'),
    )
    expect(cascadingOption2.elemID).toEqual(
      new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME, 'instance', 'cascadeContextName_option1_cascadingOption2'),
    )
    expect(orderContext.elemID).toEqual(
      new ElemID(JIRA, OPTIONS_ORDER_TYPE_NAME, 'instance', 'cascadeContextName_order_child'),
    )
    expect(orderCascade.elemID).toEqual(
      new ElemID(JIRA, OPTIONS_ORDER_TYPE_NAME, 'instance', 'cascadeContextName_option1_order_child'),
    )
    expect(context.value.defaultValue).toEqual({
      type: 'option.cascading',
      optionId: new ReferenceExpression(option1.elemID, option1),
      cascadingOptionId: new ReferenceExpression(cascadingOption2.elemID, cascadingOption2),
    })
  })
})
