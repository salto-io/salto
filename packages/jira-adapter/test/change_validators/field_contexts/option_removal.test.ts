/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeValidator,
  CORE_ANNOTATIONS,
  InstanceElement,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { fieldContextOptionRemovalValidator } from '../../../src/change_validators/field_contexts/option_removal'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  FIELD_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../../src/filters/fields/constants'
import { createEmptyType, mockClient } from '../../utils'
import JiraClient from '../../../src/client/client'

describe('fieldContextOptionRemovalValidator', () => {
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let optionInstance: InstanceElement
  let fieldInstance: InstanceElement
  let orderInstance: InstanceElement
  let contextInstance: InstanceElement
  let validator: ChangeValidator

  beforeEach(() => {
    jest.clearAllMocks()
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    const { client: cli, connection: conn } = mockClient()
    client = cli
    connection = conn

    connection.get.mockResolvedValue({
      status: 200,
      data: {
        issues: [
          {
            id: '1',
          },
          {
            id: '2',
          },
        ],
      },
    })

    fieldInstance = new InstanceElement('field', createEmptyType(FIELD_TYPE_NAME), {
      name: 'field',
      id: 'customfield_1234',
    })
    contextInstance = new InstanceElement(
      'context',
      createEmptyType(FIELD_CONTEXT_TYPE_NAME),
      {
        id: '123',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
      },
    )
    optionInstance = new InstanceElement(
      'option',
      createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
      {
        value: 'optionValue',
        id: '456',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
      },
    )
    orderInstance = new InstanceElement('order', createEmptyType(OPTIONS_ORDER_TYPE_NAME), {}, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
    })

    validator = fieldContextOptionRemovalValidator(config, client)
  })
  it('should return option and order change errors when the option is in use and there is a relevant order change', async () => {
    const changes = [toChange({ before: optionInstance }), toChange({ before: orderInstance, after: orderInstance })]
    const errors = await validator(changes)
    expect(errors).toHaveLength(2)
    expect(errors[0]).toMatchObject({
      elemID: optionInstance.elemID,
      severity: 'Error',
      message: 'Cannot remove field context option as it is in use by issues',
      detailedMessage:
        'The option "optionValue" of field "field" is in use by issues. Please migrate the issues to another option in Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=456, and then refresh the deployment.',
    })
    expect(errors[1]).toMatchObject({
      elemID: orderInstance.elemID,
      severity: 'Error',
      message: "This order is not referencing all it's options",
      detailedMessage:
        "This order cannot be deployed because it depends on removing the option 'optionValue', which cannot be deployed because it is still in use by existing issues.",
    })
  })

  it('should return an option change error when the option is in use and an order change is missing', async () => {
    const changes = [toChange({ before: optionInstance })]
    const errors = await validator(changes)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      elemID: optionInstance.elemID,
      severity: 'Error',
      message: 'Cannot remove field context option as it is in use by issues',
      detailedMessage:
        'The option "optionValue" of field "field" is in use by issues. Please migrate the issues to another option in Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=456, and then refresh the deployment.',
    })
  })

  it('should do nothing when there is no option change', async () => {
    const changes = [toChange({ before: orderInstance, after: orderInstance })]
    const errors = await validator(changes)
    expect(errors).toHaveLength(0)
  })

  it('should not return an error when the option is not in use', async () => {
    connection.get.mockResolvedValue({
      status: 200,
      data: {
        issues: [],
      },
    })
    const changes = [toChange({ before: optionInstance }), toChange({ before: orderInstance, after: orderInstance })]
    const errors = await validator(changes)
    expect(errors).toHaveLength(0)
  })

  it('should not return an error when failed to get relevant issues', async () => {
    connection.get.mockResolvedValue({
      status: 400,
      data: {},
    })
    const changes = [toChange({ before: optionInstance }), toChange({ before: orderInstance, after: orderInstance })]
    const errors = await validator(changes)
    expect(errors).toHaveLength(0)
  })
})
