/*
 * Copyright 2025 Salto Labs Ltd.
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
import { deployment, client as clientUtils, resolveChangeElement } from '@salto-io/adapter-components'

import { mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { deployContextChange } from '../../../src/filters/fields/contexts'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { getLookUpName } from '../../../src/reference_mapping'
import * as contextOptions from '../../../src/filters/fields/context_options'
import * as defaultValues from '../../../src/filters/fields/default_values'

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

describe('deployContextChange', () => {
  let contextType: ObjectType
  let parentField: InstanceElement

  const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>
  let client: JiraClient

  beforeEach(() => {
    deployChangeMock.mockClear()

    const mockCli = mockClient()
    client = mockCli.client

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    parentField = new InstanceElement('parentField', new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }), {
      id: '2',
    })
  })
  it('should call deployChange', async () => {
    const beforeInstance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      },
    )

    const afterInstance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
        description: 'desc',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      },
    )

    const change = toChange({
      before: beforeInstance,
      after: afterInstance,
    })
    await deployContextChange({ change, client, config: getDefaultConfig({ isDataCenter: false }) })

    expect(deployChangeMock).toHaveBeenCalledWith({
      change: await resolveChangeElement(change, getLookUpName),
      client,
      endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.CustomFieldContext.deployRequests,
      fieldsToIgnore: ['defaultValue', 'options', 'AssetsObjectFieldConfiguration', 'issueTypeIds', 'projectIds'],
    })
  })
  it('should not call setOptions and setDefaultValue if splitFieldContextOptions is false', async () => {
    const setOptionsMock = jest.spyOn(contextOptions, 'setContextOptions')
    const updateDefaultValuesMock = jest.spyOn(defaultValues, 'updateDefaultValues')

    const afterInstance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
        description: 'desc',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      },
    )

    const change = toChange({
      after: afterInstance,
    })
    const config = getDefaultConfig({ isDataCenter: false })
    config.fetch.splitFieldContextOptions = true
    await deployContextChange({ change, client, config })
    expect(setOptionsMock).not.toHaveBeenCalled()
    expect(updateDefaultValuesMock).not.toHaveBeenCalled()
  })
  it('should not throw if deploy failed because the field was deleted', async () => {
    const beforeInstance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      },
    )

    deployChangeMock.mockImplementation(async () => {
      throw new clientUtils.HTTPError('message', {
        status: 404,
        data: {},
      })
    })

    const change = toChange({
      before: beforeInstance,
    })
    await deployContextChange({ change, client, config: getDefaultConfig({ isDataCenter: false }) })
  })
  it('should throw for other error messages', async () => {
    const beforeInstance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      },
    )

    deployChangeMock.mockImplementation(async () => {
      throw new clientUtils.HTTPError('message', {
        status: 500,
        data: {},
      })
    })

    const change = toChange({
      before: beforeInstance,
    })
    await expect(
      deployContextChange({ change, client, config: getDefaultConfig({ isDataCenter: false }) }),
    ).rejects.toThrow()
  })
  it('should throw if not removal', async () => {
    const instance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      },
    )

    deployChangeMock.mockImplementation(async () => {
      throw new clientUtils.HTTPError('message', {
        status: 404,
        data: {
          errorMessages: ['The custom field was not found.'],
        },
      })
    })

    const instanceBefore = instance.clone()
    instanceBefore.value.description = 'desc'
    const change = toChange({
      before: instanceBefore,
      after: instance,
    })
    await expect(
      deployContextChange({ change, client, config: getDefaultConfig({ isDataCenter: false }) }),
    ).rejects.toThrow()
  })
})
