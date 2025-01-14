/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement, ReadOnlyElementsSource, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_TYPE } from '../../../src/constants'
import { createEmptyType, mockClient } from '../../utils'
import { defaultAttributeValidator } from '../../../src/change_validators/assets/default_attribute'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'
import JiraClient from '../../../src/client/client'

describe('attributeValidator', () => {
  let elementsSource: ReadOnlyElementsSource
  let attributeInstance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  const objectTypeInstance = new InstanceElement('objectTypeInstance', createEmptyType(OBJECT_TYPE_TYPE), {
    id: '1',
    name: 'ObjectType',
  })
  beforeEach(async () => {
    const { client: cli, connection: conn } = mockClient(false)
    client = cli
    connection = conn
    connection.get.mockImplementation(async url => {
      if (url === '/rest/servicedeskapi/assets/workspace') {
        return {
          status: 200,
          data: {
            values: [
              {
                workspaceId: 'workspaceId',
              },
            ],
          },
        }
      }
      if (url === '/gateway/api/jsm/assets/workspace/workspaceId/v1/objecttype/1') {
        return {
          status: 200,
          data: {},
        }
      }
      throw new Error('Unexpected url')
    })
    elementsSource = buildElementsSourceFromElements([])
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
  })
  it('should not return error if trying to add non editable defult attribute', async () => {
    attributeInstance = new InstanceElement('attribute1', createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE), {
      id: 22,
      name: 'Key',
      editable: false,
      objectType: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
    })
    const validator = defaultAttributeValidator(config, client)
    const changeErrors = await validator([toChange({ after: attributeInstance })], elementsSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error if trying to modify non editable defult attribute', async () => {
    attributeInstance = new InstanceElement('attribute1', createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE), {
      id: 22,
      name: 'Created',
      editable: false,
      objectType: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
    })
    const validator = defaultAttributeValidator(config, client)
    const changeErrors = await validator(
      [toChange({ before: attributeInstance, after: attributeInstance })],
      elementsSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should return error if trying to remove non editable defult attribute', async () => {
    attributeInstance = new InstanceElement('attribute1', createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE), {
      id: 22,
      name: 'Updated',
      editable: false,
      objectType: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
    })
    const validator = defaultAttributeValidator(config, client)
    const changeErrors = await validator([toChange({ before: attributeInstance })], elementsSource)
    expect(changeErrors).toHaveLength(1)
  })
  it('should not return error if trying to add editable defult attribute', async () => {
    attributeInstance = new InstanceElement('attribute1', createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE), {
      id: 22,
      name: 'Name',
      editable: true,
      objectType: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
    })
    const validator = defaultAttributeValidator(config, client)
    const changeErrors = await validator([toChange({ after: attributeInstance })], elementsSource)
    expect(changeErrors).toHaveLength(0)
  })
})
