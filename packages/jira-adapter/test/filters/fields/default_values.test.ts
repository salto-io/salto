/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import {
  setDefaultValueTypeDeploymentAnnotations,
  updateDefaultValues,
} from '../../../src/filters/fields/default_values'
import { JIRA } from '../../../src/constants'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { createEmptyType } from '../../utils'

describe('default values', () => {
  describe('updateDefaultValues', () => {
    let client: MockInterface<clientUtils.HTTPWriteClientInterface>
    let config: JiraConfig
    let type: ObjectType

    beforeEach(() => {
      client = {
        post: mockFunction<clientUtils.HTTPWriteClientInterface['post']>(),
        put: mockFunction<clientUtils.HTTPWriteClientInterface['put']>(),
        delete: mockFunction<clientUtils.HTTPWriteClientInterface['delete']>(),
        patch: mockFunction<clientUtils.HTTPWriteClientInterface['patch']>(),
      }
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      type = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME) })
    })

    it('Should update the edited default value', async () => {
      const before = new InstanceElement('instance', type, {
        name: 'a',
        id: 3,
        options: {
          p1: {
            id: 1,
          },
          p2: {
            id: 2,
          },
        },
        defaultValue: {
          type: 'float',
          optionId: new ReferenceExpression(type.elemID.createNestedID('instance', 'instance', 'options', 'p1'), {}),
        },
      })

      const after = new InstanceElement(
        'instance',
        type,
        {
          name: 'a',
          id: 3,
          options: {
            p1: {
              id: 1,
            },
            p2: {
              id: 2,
            },
          },
          defaultValue: {
            type: 'float',
            optionId: new ReferenceExpression(type.elemID.createNestedID('instance', 'instance', 'options', 'p2'), {}),
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [{ id: '2' }],
        },
      )

      await updateDefaultValues(toChange({ before, after }), client, config)

      expect(client.put).toHaveBeenCalledWith({
        url: '/rest/api/3/field/2/context/defaultValue',
        data: {
          defaultValues: [
            {
              contextId: 3,
              type: 'float',
              optionId: 2,
            },
          ],
        },
      })
    })

    it('Should remove the removed default value', async () => {
      const before = new InstanceElement('instance', type, {
        name: 'a',
        id: 3,
        defaultValue: {
          type: 'float',
          number: 9,
        },
      })

      const after = new InstanceElement(
        'instance',
        type,
        {
          name: 'a',
          id: 3,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [{ id: '2' }],
        },
      )

      await updateDefaultValues(toChange({ before, after }), client, config)

      expect(client.put).toHaveBeenCalledWith({
        url: '/rest/api/3/field/2/context/defaultValue',
        data: {
          defaultValues: [
            {
              contextId: 3,
              type: 'float',
              number: null,
            },
          ],
        },
      })
    })

    it('if context were deleted should do nothing', async () => {
      const before = new InstanceElement('instance', type, {
        name: 'a',
        id: 3,
        defaultValue: {
          type: 'float',
          number: 9,
        },
      })
      await updateDefaultValues(toChange({ before }), client, config)
      expect(client.put).not.toHaveBeenCalled()
    })
    it('should call the APIs correctly when splitFieldContextOptions is true', async () => {
      config.fetch.splitFieldContextOptions = true
      const optionInstance = new InstanceElement('option', createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME), {
        id: 111,
      })

      const before = new InstanceElement('instance', type, {
        name: 'a',
        id: 3,
        defaultValue: {
          optionId: new ReferenceExpression(optionInstance.elemID, optionInstance),
          type: 'float',
          number: 9,
        },
      })

      const after = new InstanceElement(
        'instance',
        type,
        {
          name: 'a',
          id: 3,
          defaultValue: {
            optionId: new ReferenceExpression(optionInstance.elemID, optionInstance),
            type: 'float',
            number: 8,
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [{ id: '2' }],
        },
      )

      await updateDefaultValues(toChange({ before, after }), client, config)

      expect(client.put).toHaveBeenCalledWith({
        url: '/rest/api/3/field/2/context/defaultValue',
        data: {
          defaultValues: [
            {
              optionId: 111,
              contextId: 3,
              type: 'float',
              number: 8,
            },
          ],
        },
      })
    })
    it('should resolve default value optionIds, optionId and cascadingOptionId correctly', async () => {
      const after = new InstanceElement(
        'instance',
        type,
        {
          name: 'a',
          id: 3,
          options: {
            p1: {
              id: 1,
            },
            p2: {
              id: 2,
            },
          },
          defaultValue: {
            optionId: new ReferenceExpression(type.elemID.createNestedID('instance', 'instance', 'options', 'p2'), {}),
            optionIds: [
              new ReferenceExpression(type.elemID.createNestedID('instance', 'instance', 'options', 'p2'), {}),
            ],
            cascadingOptionId: new ReferenceExpression(
              type.elemID.createNestedID('instance', 'instance', 'options', 'p2'),
              {},
            ),
            type: 'option.multiple',
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [{ id: '2' }],
        },
      )

      await updateDefaultValues(toChange({ after }), client, config)

      expect(client.put).toHaveBeenCalledWith({
        url: '/rest/api/3/field/2/context/defaultValue',
        data: {
          defaultValues: [
            {
              optionId: 2,
              optionIds: [2],
              cascadingOptionId: 2,
              contextId: 3,
              type: 'option.multiple',
            },
          ],
        },
      })
    })
    it('should resolve default value optionIds, optionId and cascadingOptionId correctly when splitFieldContextOptions is true', async () => {
      config.fetch.splitFieldContextOptions = true
      const optionInstance = new InstanceElement('option', createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME), {
        id: 111,
      })

      const after = new InstanceElement(
        'instance',
        type,
        {
          name: 'a',
          id: 3,
          defaultValue: {
            optionId: new ReferenceExpression(optionInstance.elemID, optionInstance),
            optionIds: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
            cascadingOptionId: new ReferenceExpression(optionInstance.elemID, optionInstance),
            type: 'option.multiple',
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [{ id: '2' }],
        },
      )

      await updateDefaultValues(toChange({ after }), client, config)

      expect(client.put).toHaveBeenCalledWith({
        url: '/rest/api/3/field/2/context/defaultValue',
        data: {
          defaultValues: [
            {
              optionId: 111,
              optionIds: [111],
              cascadingOptionId: 111,
              contextId: 3,
              type: 'option.multiple',
            },
          ],
        },
      })
    })
  })

  describe('setDefaultValueTypeDeploymentAnnotations', () => {
    it('should throw an error if defaultValueType is not an objectType', async () => {
      const contextType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
      await expect(setDefaultValueTypeDeploymentAnnotations(contextType)).rejects.toThrow()
    })
  })
})
