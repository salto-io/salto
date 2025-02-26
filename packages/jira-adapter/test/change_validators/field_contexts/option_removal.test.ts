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

const generateNOptions = (n: number, fieldParent: InstanceElement): InstanceElement[] =>
  _.range(n).map(
    i =>
      new InstanceElement(
        `option${i}`,
        createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
        { value: `option${i}`, id: `${i}` },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldParent.elemID, fieldParent)],
        },
      ),
  )

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
        id: '11',
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

  describe('select list', () => {
    beforeEach(() => {
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          issues: [
            {
              id: '1',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
            {
              id: '2',
              fields: {
                customfield_1234: {
                  id: '111',
                },
              },
            },
          ],
        },
      })
    })

    it('should return option and order change errors when the option is in use', async () => {
      const changes = [toChange({ before: optionInstance }), toChange({ before: orderInstance, after: orderInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(2)
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
      expect(errors[1]).toMatchObject({
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: 'This order cannot be deployed',
        detailedMessage:
          'This order cannot be deployed because it depends on removing the options "optionValue", that are still in use by existing issues.',
      })
    })
  })

  describe('multi select list', () => {
    let optionInstance2: InstanceElement
    beforeEach(() => {
      optionInstance2 = new InstanceElement(
        'option2',
        createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
        {
          value: 'optionValue2',
          id: '22',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
        },
      )
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          issues: [
            {
              id: '1',
              fields: {
                customfield_1234: [
                  {
                    id: '11',
                  },
                  {
                    id: '22',
                  },
                ],
              },
            },
            {
              id: '2',
              fields: {
                customfield_1234: [
                  {
                    id: '11',
                  },
                ],
              },
            },
          ],
        },
      })
    })
    it('should return option and order change errors when the option is in use', async () => {
      const changes = [
        toChange({ before: optionInstance }),
        toChange({ before: optionInstance2 }),
        toChange({ before: orderInstance, after: orderInstance }),
      ]
      const errors = await validator(changes)
      expect(errors).toHaveLength(3)
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
      expect(errors[1]).toMatchObject({
        elemID: optionInstance2.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue2" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=22 and then refresh your deployment.',
      })
      expect(errors[2]).toMatchObject({
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: 'This order cannot be deployed',
        detailedMessage:
          'This order cannot be deployed because it depends on removing the options "optionValue", "optionValue2", that are still in use by existing issues.',
      })
    })
  })

  describe('cascading select list', () => {
    let cascadingOptionInstance: InstanceElement
    let cascadingOrderInstance: InstanceElement
    beforeEach(() => {
      cascadingOptionInstance = new InstanceElement(
        'cascadingOption',
        createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
        {
          value: 'cascadingOptionValue',
          id: '33',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
        },
      )
      cascadingOrderInstance = new InstanceElement(
        'cascadingOrder',
        createEmptyType(OPTIONS_ORDER_TYPE_NAME),
        {},
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
        },
      )
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          issues: [
            {
              id: '1',
              fields: {
                customfield_1234: {
                  id: '11',
                  child: {
                    id: '33',
                  },
                },
              },
            },
          ],
        },
      })
    })
    it('should return cascade option and cascade order change errors when the option is in use', async () => {
      const changes = [toChange({ before: cascadingOptionInstance }), toChange({ before: cascadingOrderInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(2)
      expect(errors[0]).toMatchObject({
        elemID: cascadingOptionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue-cascadingOptionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=33 and then refresh your deployment.',
      })
      expect(errors[1]).toMatchObject({
        elemID: cascadingOrderInstance.elemID,
        severity: 'Error',
        message: 'This order cannot be deployed',
        detailedMessage:
          'This order cannot be deployed because it depends on removing the options "optionValue-cascadingOptionValue", that are still in use by existing issues.',
      })
    })

    it('should return option, cascade option, order, and cascade order change errors when the option is in use', async () => {
      const changes = [
        toChange({ before: optionInstance }),
        toChange({ before: cascadingOptionInstance }),
        toChange({ before: orderInstance, after: orderInstance }),
        toChange({ before: cascadingOrderInstance }),
      ]
      const errors = await validator(changes)
      expect(errors).toHaveLength(4)
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
      expect(errors[1]).toMatchObject({
        elemID: cascadingOptionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue-cascadingOptionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=33 and then refresh your deployment.',
      })
      expect(errors[2]).toMatchObject({
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: 'This order cannot be deployed',
        detailedMessage:
          'This order cannot be deployed because it depends on removing the options "optionValue", that are still in use by existing issues.',
      })
      expect(errors[3]).toMatchObject({
        elemID: cascadingOrderInstance.elemID,
        severity: 'Error',
        message: 'This order cannot be deployed',
        detailedMessage:
          'This order cannot be deployed because it depends on removing the options "optionValue-cascadingOptionValue", that are still in use by existing issues.',
      })
    })
  })
  // the general usage test is with a select list field
  describe('general usage', () => {
    let fieldInstance2: InstanceElement
    let contextInstance2: InstanceElement
    let optionInstance2: InstanceElement
    let optionInstance3: InstanceElement
    let optionInstance4: InstanceElement
    let orderInstance2: InstanceElement

    beforeEach(() => {
      fieldInstance2 = new InstanceElement('field2', createEmptyType(FIELD_TYPE_NAME), {
        name: 'field2',
        id: 'customfield_5678',
      })
      contextInstance2 = new InstanceElement(
        'context2',
        createEmptyType(FIELD_CONTEXT_TYPE_NAME),
        {
          id: '456',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance2.elemID, fieldInstance2)],
        },
      )
      optionInstance2 = new InstanceElement(
        'option2',
        createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
        {
          value: 'optionValue2',
          id: '22',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance2.elemID, contextInstance2)],
        },
      )
      optionInstance3 = new InstanceElement(
        'option3',
        createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
        {
          value: 'optionValue3',
          id: '33',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance2.elemID, contextInstance2)],
        },
      )
      optionInstance4 = new InstanceElement(
        'option4',
        createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
        {
          value: 'optionValue4',
          id: '44',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance2.elemID, contextInstance2)],
        },
      )
      orderInstance2 = new InstanceElement('order2', createEmptyType(OPTIONS_ORDER_TYPE_NAME), {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance2.elemID, contextInstance2)],
      })
      connection.post.mockImplementation(async (_url, data) => {
        if (Array.isArray(data.fields) && data.fields[0] === 'customfield_1234') {
          return {
            status: 200,
            data: {
              issues: [
                {
                  id: '1',
                  fields: {
                    customfield_1234: {
                      id: '11',
                    },
                  },
                },
                {
                  id: '2',
                  fields: {
                    customfield_1234: {
                      id: '22',
                    },
                  },
                },
              ],
            },
          }
        }
        if (Array.isArray(data.fields) && data.fields[0] === 'customfield_5678') {
          return {
            status: 200,
            data: {
              issues: [
                {
                  id: '1',
                  fields: {
                    customfield_5678: {
                      id: '22',
                    },
                  },
                },
                {
                  id: '2',
                  fields: {
                    customfield_5678: {
                      id: '33',
                    },
                  },
                },
                {
                  id: '3',
                  fields: {
                    customfield_5678: {
                      id: '44',
                    },
                  },
                },
              ],
            },
          }
        }
        return {
          status: 200,
          data: {
            issues: [],
          },
        }
      })
    })

    it('should return an option change error when the option is in use and an order change is missing', async () => {
      const changes = [toChange({ before: optionInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
    })

    it('should return options and order errors of multiple fields', async () => {
      const changes = [
        // field 1
        toChange({ before: optionInstance2 }),
        toChange({ before: optionInstance3 }),
        toChange({ before: optionInstance4 }),
        toChange({ before: orderInstance2, after: orderInstance2 }),
        // field 2
        toChange({ before: optionInstance }),
        toChange({ before: orderInstance, after: orderInstance }),
      ]
      const errors = await validator(changes)
      expect(errors).toHaveLength(6)
      expect(errors[0]).toMatchObject({
        elemID: optionInstance2.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue2" in the field "field2" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=456&selectedValue=22 and then refresh your deployment.',
      })
      expect(errors[1]).toMatchObject({
        elemID: optionInstance3.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue3" in the field "field2" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=456&selectedValue=33 and then refresh your deployment.',
      })
      expect(errors[2]).toMatchObject({
        elemID: optionInstance4.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue4" in the field "field2" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=456&selectedValue=44 and then refresh your deployment.',
      })
      expect(errors[3]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
      expect(errors[4]).toMatchObject({
        elemID: orderInstance2.elemID,
        severity: 'Error',
        message: 'This order cannot be deployed',
        detailedMessage:
          'This order cannot be deployed because it depends on removing the options "optionValue2", "optionValue3", "optionValue4", that are still in use by existing issues.',
      })
      expect(errors[5]).toMatchObject({
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: 'This order cannot be deployed',
        detailedMessage:
          'This order cannot be deployed because it depends on removing the options "optionValue", that are still in use by existing issues.',
      })
    })

    it('should do nothing when there is no option change', async () => {
      const changes = [toChange({ before: orderInstance, after: orderInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(0)
    })

    it.only('should do nothing if the context is being deleted as well', async () => {
      const changes = [
        toChange({ before: optionInstance }),
        toChange({ before: orderInstance, after: orderInstance }),
        toChange({ before: contextInstance }),
      ]
      const errors = await validator(changes)
      expect(errors).toHaveLength(0)
    })

    it('should not return an error when the option is not in use', async () => {
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          issues: [],
        },
      })
      const changes = [toChange({ before: optionInstance }), toChange({ before: orderInstance, after: orderInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(0)
    })

    it('should return a warning when failed to get relevant issues', async () => {
      connection.post.mockRejectedValueOnce({
        status: 400,
        data: {
          errorMessages: ['error'],
        },
      })
      const changes = [toChange({ before: optionInstance }), toChange({ before: orderInstance, after: orderInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Warning',
        message: 'Cannot determine the status of the deleted option',
        detailedMessage:
          'The option "optionValue" in the field "field" might be assigned to some issues. Please check it before proceeding as it may leads to data loss.',
      })
    })

    it('should return an error when succeed to get some relevant issues for option', async () => {
      connection.post.mockResolvedValueOnce({
        status: 200,
        data: {
          issues: [
            {
              id: '1',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
          ],
          nextPageToken: 'nextPageToken',
        },
      })
      connection.post.mockRejectedValueOnce({
        status: 400,
        data: {
          errorMessages: ['error'],
        },
      })
      const changes = [toChange({ before: optionInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
    })

    it('should return the collected errors before rejected and warnings for unknown options', async () => {
      connection.post.mockResolvedValueOnce({
        status: 200,
        data: {
          issues: [
            {
              id: '1',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
          ],
          newPageToken: 'nextPageToken',
        },
      })
      connection.post.mockRejectedValueOnce({
        status: 400,
        data: {
          errorMessages: ['error'],
        },
      })
      const changes = [toChange({ before: optionInstance }), toChange({ before: optionInstance2 })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(2)
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
      expect(errors[1]).toMatchObject({
        elemID: optionInstance2.elemID,
        severity: 'Warning',
        message: 'Cannot determine the status of the deleted option',
        detailedMessage:
          'The option "optionValue2" in the field "field2" might be assigned to some issues. Please check it before proceeding as it may leads to data loss.',
      })
    })
    it('should use chunks when there are too many options', async () => {
      const options = generateNOptions(1250, contextInstance)
      const changes = options.map(option => toChange({ before: option }))
      const errors = await validator(changes)
      expect(errors).toHaveLength(2)
      expect(connection.post).toHaveBeenCalledTimes(3)
    })
  })
  describe('pagination', () => {
    it('should ask for the next page as needed', async () => {
      connection.post.mockResolvedValueOnce({
        status: 200,
        data: {
          issues: [
            {
              id: '1',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
            {
              id: '2',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
          ],
          nextPageToken: 'nextPageToken1',
        },
      })
      connection.post.mockResolvedValueOnce({
        status: 200,
        data: {
          issues: [
            {
              id: '1',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
            {
              id: '2',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
          ],
          nextPageToken: 'nextPageToken2',
        },
      })
      connection.post.mockResolvedValueOnce({
        status: 200,
        data: {
          issues: [
            {
              id: '1',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
            {
              id: '2',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
          ],
        },
      })
      const changes = [toChange({ before: optionInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(3)
      expect(connection.post).toHaveBeenNthCalledWith(
        1,
        'rest/api/3/search/jql',
        {
          jql: 'cf[1234] in (11)',
          fields: ['customfield_1234'],
          maxResults: 1000,
        },
        undefined,
      )
      expect(connection.post).toHaveBeenNthCalledWith(
        2,
        'rest/api/3/search/jql',
        {
          jql: 'cf[1234] in (11)',
          fields: ['customfield_1234'],
          nextPageToken: 'nextPageToken1',
          maxResults: 1000,
        },
        undefined,
      )
      expect(connection.post).toHaveBeenNthCalledWith(
        3,
        'rest/api/3/search/jql',
        {
          jql: 'cf[1234] in (11)',
          fields: ['customfield_1234'],
          nextPageToken: 'nextPageToken2',
          maxResults: 1000,
        },
        undefined,
      )
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
    })

    it('should stop pagination when nextPageToken has not changed', async () => {
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          issues: [
            {
              id: '1',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
            {
              id: '2',
              fields: {
                customfield_1234: {
                  id: '11',
                },
              },
            },
          ],
          nextPageToken: 'nextPageToken',
        },
      })
      const changes = [toChange({ before: optionInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(2)
      expect(connection.post).toHaveBeenNthCalledWith(
        1,
        'rest/api/3/search/jql',
        {
          jql: 'cf[1234] in (11)',
          fields: ['customfield_1234'],
          maxResults: 1000,
        },
        undefined,
      )
      expect(connection.post).toHaveBeenNthCalledWith(
        2,
        'rest/api/3/search/jql',
        {
          jql: 'cf[1234] in (11)',
          fields: ['customfield_1234'],
          nextPageToken: 'nextPageToken',
          maxResults: 1000,
        },
        undefined,
      )
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
    })
    it('should stop pagination when max iterations reached', async () => {
      _.range(105).forEach(i => {
        connection.post.mockResolvedValueOnce({
          status: 200,
          data: {
            issues: [
              {
                id: '1',
                fields: {
                  customfield_1234: {
                    id: '11',
                  },
                },
              },
            ],
            nextPageToken: `nextPageToken${i}`,
          },
        })
      })
      const changes = [toChange({ before: optionInstance })]
      const errors = await validator(changes)
      expect(errors).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(100)
      expect(errors[0]).toMatchObject({
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context option as it is still in use by existing issues',
        detailedMessage:
          'The option "optionValue" in the field "field" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via https://ori-salto-test.atlassian.net//secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=123&selectedValue=11 and then refresh your deployment.',
      })
    })
  })
})
