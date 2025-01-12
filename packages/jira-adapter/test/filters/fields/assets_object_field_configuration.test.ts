/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import {
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import assetsObjectFieldConfigurationFilter, {
  deployAssetObjectContext,
} from '../../../src/filters/assets/assets_object_field_configuration'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { ASSETS_OBJECT_FIELD_CONFIGURATION_TYPE, JIRA, OBJECT_SCHEMA_TYPE } from '../../../src/constants'

const VALID_HTML = `<!DOCTYPE html><html><head>
  <a id="customfield_10000-edit-cmdbObjectFieldConfig" class="actionLinks subText" title="Edit Assets object/s field configuration" href="CmdbObjectFieldConfiguration;fieldConfigSchemeId=11111&amp;fieldConfigId=55555&amp;customFieldId=10000&amp;returnUrl=ConfigureCustomField%21default.jspa%3FcustomFieldId%3D14156">Edit Assets object/s field configuration</a>
  <a id="customfield_10000-edit-cmdbObjectFieldConfig" class="actionLinks subText" title="Edit Assets object/s field configuration" href="CmdbObjectFieldConfiguration;fieldConfigSchemeId=22222&amp;fieldConfigId=66666&amp;customFieldId=10000&amp;returnUrl=ConfigureCustomField%21default.jspa%3FcustomFieldId%3D14156">Edit Assets object/s field configuration</a>
  </head></html>`
const HTML_WITH_UNEXPECTED_CONTEXT_ID = `<!DOCTYPE html><html><head>
  <a id="customfield_10000-edit-cmdbObjectFieldConfig" class="actionLinks subText" title="Edit Assets object/s field configuration" href="CmdbObjectFieldConfiguration;fieldConfigSchemeId=000000&amp;fieldConfigId=55555&amp;customFieldId=10000&amp;returnUrl=ConfigureCustomField%21default.jspa%3FcustomFieldId%3D14156">Edit Assets object/s field configuration</a>
  </head></html>`
const HTML_WITH_INVALID_CONFIG_ID = `<!DOCTYPE html><html><head>
  <a id="customfield_10000-edit-cmdbObjectFieldConfig" class="actionLinks subText" title="Edit Assets object/s field configuration" href="CmdbObjectFieldConfiguration;fieldConfigSchemeId=11111&amp;fieldConfigIdInvalid=55555&amp;customFieldId=10000&amp;returnUrl=ConfigureCustomField%21default.jspa%3FcustomFieldId%3D14156">Edit Assets object/s field configuration</a>
  </head></html>`
const HTML_WITHOUT_HREF = `<!DOCTYPE html><html><head>
  <a id="customfield_10000-edit-cmdbObjectFieldConfig" class="actionLinks subText" title="Edit Assets object/s field configuration" >Edit Assets object/s field configuration</a>
  </head></html>`

const ASSETS_OBJECT_RESPONSE_1 = {
  objectSchemaId: '23',
  workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
  objectSchemaName: 'quack',
  attributesIncludedInAutoCompleteSearch: ['MyAttribute'],
  attributesDisplayedOnIssue: ['MyAttribute'],
  multiple: false,
  shouldSetDefaultValuesFromEmptySearch: false,
  attributesLimit: 50,
}

const ASSETS_OBJECT_RESPONSE_2 = {
  objectSchemaId: '42',
  workspaceId: '68d020c3-b88e-47dc-9231-452f7dc63521',
  objectSchemaName: 'quack',
  attributesIncludedInAutoCompleteSearch: ['QuackAttribute'],
  attributesDisplayedOnIssue: ['QuackAttribute'],
  multiple: true,
  shouldSetDefaultValuesFromEmptySearch: false,
  attributesLimit: 50,
}

const ASSETS_OBJECT_CONFIGURATION_FIELDS_TO_REMOVE = ['workspaceId', 'attributesLimit', 'objectSchemaName']

const logging = logger('jira-adapter/src/filters/assets/assets_object_field_configuration')
const logErrorSpy = jest.spyOn(logging, 'error')

describe('assetsObjectFieldConfiguration', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let client: JiraClient
  let config: JiraConfig
  let elements: Element[]
  let changes: Change[]
  let contextInstance1: InstanceElement
  let contextInstance2: InstanceElement
  let fieldContextType: ObjectType
  let fieldInstance: InstanceElement
  let connection: MockInterface<clientUtils.APIConnection>

  beforeEach(() => {
    fieldContextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    fieldInstance = new InstanceElement('field', createEmptyType(FIELD_TYPE_NAME), {
      name: 'field',
      id: 'customfield_10000',
      type: 'com.atlassian.jira.plugins.cmdb:cmdb-object-cftype',
    })

    contextInstance1 = new InstanceElement(
      'context1',
      fieldContextType,
      {
        name: 'context',
        id: '11111',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
      },
    )
    contextInstance2 = new InstanceElement(
      'context2',
      createEmptyType(FIELD_CONTEXT_TYPE_NAME),
      {
        name: 'context2',
        id: '22222',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
      },
    )

    fieldInstance.value.contexts = [
      new ReferenceExpression(contextInstance1.elemID, contextInstance1),
      new ReferenceExpression(contextInstance2.elemID, contextInstance2),
    ]
  })
  describe('onFetch', () => {
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableAssetsObjectFieldConfiguration = true
      filter = assetsObjectFieldConfigurationFilter(
        getFilterParams({
          client,
          config,
        }),
      ) as typeof filter
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: VALID_HTML,
      })
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: ASSETS_OBJECT_RESPONSE_1,
      })
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: ASSETS_OBJECT_RESPONSE_2,
      })
    })

    it('should add assetsObjectFieldConfigurationType', async () => {
      elements = []
      await filter.onFetch(elements)
      expect(elements.length).toBe(1)
      const assetsObjectFieldConfigurationType = elements[0] as ObjectType
      expect(assetsObjectFieldConfigurationType.elemID).toEqual(new ElemID(JIRA, 'AssetsObjectFieldConfiguration'))
      expect(assetsObjectFieldConfigurationType.fields.id.annotations).toEqual({
        [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
      })
    })

    it('should add assetsObjectFieldConfiguration field to fieldContext type', async () => {
      elements = [fieldContextType]
      await filter.onFetch(elements)
      expect(elements.length).toBe(2)
      expect(fieldContextType.fields.assetsObjectFieldConfiguration).toBeDefined()
      expect(fieldContextType.fields.assetsObjectFieldConfiguration.annotations).toEqual(
        expect.objectContaining({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
          [CORE_ANNOTATIONS.DELETABLE]: true,
        }),
      )
    })

    it('should not add a field to fieldContext type if it is not found', async () => {
      elements = []
      await filter.onFetch(elements)
      expect(fieldContextType.fields.assetsObjectFieldConfiguration).toBeUndefined()
    })

    it('should not add a field to fieldContext type when the flag is disabled', async () => {
      config.fetch.enableAssetsObjectFieldConfiguration = false
      elements = []
      await filter.onFetch(elements)
      expect(fieldContextType.fields.assetsObjectFieldConfiguration).toBeUndefined()
    })

    it('should add assetsObjectFieldConfiguration to fieldContext instances', async () => {
      elements = [fieldContextType, fieldInstance, contextInstance1, contextInstance2]
      await filter.onFetch(elements)
      expect(contextInstance1.value.assetsObjectFieldConfiguration).toEqual({
        id: '55555',
        ..._.omit(ASSETS_OBJECT_RESPONSE_1, ASSETS_OBJECT_CONFIGURATION_FIELDS_TO_REMOVE),
      })
      expect(contextInstance2.value.assetsObjectFieldConfiguration).toEqual({
        id: '66666',
        ..._.omit(ASSETS_OBJECT_RESPONSE_2, ASSETS_OBJECT_CONFIGURATION_FIELDS_TO_REMOVE),
      })
    })

    it('should log error when html response is not valid', async () => {
      connection.get.mockReset()
      connection.get.mockResolvedValue({
        status: 200,
        data: { invalid: 'invalid' },
      })
      elements = [fieldContextType, fieldInstance, contextInstance1, contextInstance2]
      await filter.onFetch(elements)
      expect(logErrorSpy).toHaveBeenCalledWith(expect.toEndWith('Failed to get HTML for assets context id'))
    })

    it('should log error when html structure is invalid', async () => {
      connection.get.mockReset()
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: HTML_WITH_INVALID_CONFIG_ID,
      })
      elements = [fieldContextType, fieldInstance, contextInstance1, contextInstance2]
      await filter.onFetch(elements)
      expect(logErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to extract a match from the input'))
    })

    it('should log error when href is missing', async () => {
      connection.get.mockReset()
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: HTML_WITHOUT_HREF,
      })
      elements = [fieldContextType, fieldInstance, contextInstance1, contextInstance2]
      await filter.onFetch(elements)
      expect(logErrorSpy).toHaveBeenCalledWith(expect.toEndWith('Failed to get href from link element'))
    })

    it('should log error when html context id does not match any context id', async () => {
      connection.get.mockReset()
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: HTML_WITH_UNEXPECTED_CONTEXT_ID,
      })
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: ASSETS_OBJECT_RESPONSE_1,
      })
      elements = [fieldContextType, fieldInstance, contextInstance1, contextInstance2]
      await filter.onFetch(elements)
      expect(logErrorSpy).toHaveBeenCalledWith(expect.toEndWith('Failed to find field context with id 000000'))
    })
  })
  describe('preDeploy', () => {
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableAssetsObjectFieldConfiguration = true
      config.fetch.enableJSMPremium = true
      filter = assetsObjectFieldConfigurationFilter(
        getFilterParams({
          client,
          config,
        }),
      ) as typeof filter
      connection.get.mockResolvedValue({
        status: 200,
        data: {
          values: [
            {
              workspaceId: 'workspaceId',
            },
          ],
        },
      })
      contextInstance1.value.assetsObjectFieldConfiguration = {
        id: '55555',
      }
    })

    it('should add workspaceId to assetsObjectFieldConfiguration', async () => {
      changes = [toChange({ after: contextInstance1 })]
      await filter.preDeploy(changes)
      expect(contextInstance1.value.assetsObjectFieldConfiguration.workspaceId).toEqual('workspaceId')
    })

    it('should add attributesDisplayedOnIssue when it is undefined', async () => {
      changes = [toChange({ after: contextInstance1 })]
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue).toBeUndefined()
      await filter.preDeploy(changes)
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue).toEqual([])
    })

    it('should not add attributesDisplayedOnIssue when it is defined', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue = ['MyAttribute']
      changes = [toChange({ after: contextInstance1 })]
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue).toEqual(['MyAttribute'])
      await filter.preDeploy(changes)
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue).toEqual(['MyAttribute'])
    })

    it('should do nothing when the context does not have assetsObjectFieldConfiguration', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration = undefined
      changes = [toChange({ after: contextInstance1 })]
      await filter.preDeploy(changes)
      expect(contextInstance1.value.assetsObjectFieldConfiguration).toBeUndefined()
    })
  })
  describe('onDeploy', () => {
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableAssetsObjectFieldConfiguration = true
      filter = assetsObjectFieldConfigurationFilter(
        getFilterParams({
          client,
          config,
        }),
      ) as typeof filter
      contextInstance1.value.assetsObjectFieldConfiguration = {
        id: '55555',
        workspaceId: 'workspaceId',
        attributesDisplayedOnIssue: [],
      }
    })

    it('should remove workspaceId from assetsObjectFieldConfiguration', async () => {
      changes = [toChange({ after: contextInstance1 })]
      await filter.onDeploy(changes)
      expect(contextInstance1.value.assetsObjectFieldConfiguration.workspaceId).toBeUndefined()
    })

    it('should remove attributesDisplayedOnIssue when it is empty', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue = []
      changes = [toChange({ after: contextInstance1 })]
      await filter.onDeploy(changes)
      expect(contextInstance1.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue).toBeUndefined()
    })

    it('should do nothing when the context does not have assetsObjectFieldConfiguration', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration = undefined
      changes = [toChange({ after: contextInstance1 })]
      await filter.onDeploy(changes)
      expect(contextInstance1.value.assetsObjectFieldConfiguration).toBeUndefined()
    })
  })

  describe('deployAssetObjectContext', () => {
    let objectSchemaInstance: InstanceElement
    let assetsObjectFieldConfigurationType: ObjectType

    beforeEach(() => {
      assetsObjectFieldConfigurationType = new ObjectType({
        elemID: new ElemID(JIRA, ASSETS_OBJECT_FIELD_CONFIGURATION_TYPE),
        fields: {
          objectSchemaId: { refType: BuiltinTypes.STRING },
        },
      })
      fieldContextType = new ObjectType({
        elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
        fields: {
          assetsObjectFieldConfiguration: { refType: assetsObjectFieldConfigurationType },
        },
      })
      objectSchemaInstance = new InstanceElement('objectSchemaInstance', createEmptyType(OBJECT_SCHEMA_TYPE), {
        id: '23',
        name: 'objectSchemaInstanceName',
      })
      contextInstance1 = new InstanceElement(
        'context1',
        fieldContextType,
        {
          name: 'context',
          id: '11111',
          assetsObjectFieldConfiguration: {
            id: '55555',
            objectSchemaId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
            workspaceId: 'workspaceId',
            attributesDisplayedOnIssue: [],
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
        },
      )
      const { client: cli, connection: conn } = mockClient()
      client = cli
      connection = conn
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableAssetsObjectFieldConfiguration = true
      connection.get.mockReset()
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: VALID_HTML,
      })
    })

    it('should do nothing when the context does not have assetsObjectFieldConfiguration', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration = undefined
      await deployAssetObjectContext(toChange({ after: contextInstance1 }), client, config)
      expect(connection.put).not.toHaveBeenCalled()
    })

    it('should do nothing when the context does not have objectSchemaId', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration.objectSchemaId = undefined
      await deployAssetObjectContext(toChange({ after: contextInstance1 }), client, config)
      expect(connection.put).not.toHaveBeenCalled()
    })

    it('should do nothing when it is a removal change', async () => {
      await deployAssetObjectContext(toChange({ before: contextInstance1 }), client, config)
      expect(connection.put).not.toHaveBeenCalled()
    })

    it('should throw when there is no workspaceId', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration.workspaceId = undefined
      await expect(deployAssetObjectContext(toChange({ after: contextInstance1 }), client, config)).rejects.toThrow()
    })

    it('should deploy assetsObjectFieldConfiguration addition change', async () => {
      contextInstance1.value.assetsObjectFieldConfiguration.id = undefined
      await deployAssetObjectContext(toChange({ after: contextInstance1 }), client, config)
      expect(connection.get).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        'rest/servicedesk/cmdb/latest/fieldconfig/55555',
        {
          workspaceId: 'workspaceId',
          objectSchemaId: '23',
          attributesDisplayedOnIssue: [],
        },
        { headers: { 'X-Atlassian-Token': 'no-check' } },
      )
    })

    it('should deploy assetsObjectFieldConfiguration modification change', async () => {
      await deployAssetObjectContext(toChange({ before: contextInstance1, after: contextInstance1 }), client, config)
      expect(connection.get).not.toHaveBeenCalled()
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        'rest/servicedesk/cmdb/latest/fieldconfig/55555',
        {
          workspaceId: 'workspaceId',
          objectSchemaId: '23',
          attributesDisplayedOnIssue: [],
        },
        { headers: { 'X-Atlassian-Token': 'no-check' } },
      )
    })

    it('should throw when html response is not valid', async () => {
      connection.get.mockReset()
      connection.get.mockResolvedValue({
        status: 200,
        data: { invalid: 'invalid' },
      })
      await expect(deployAssetObjectContext(toChange({ after: contextInstance1 }), client, config)).rejects.toThrow()
    })

    it('should throw the correct error when it is CMBD error', async () => {
      connection.put.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            errors: [
              {
                errorMessage: 'first error',
              },
              {
                errorMessage: 'second error',
              },
            ],
          },
        },
      })
      await expect(
        deployAssetObjectContext(toChange({ after: contextInstance1 }), client, config),
      ).rejects.toThrowWithMessage(
        Error,
        'Failed to deploy asset object field configuration for instance jira.CustomFieldContext.instance.context1 with error: first error, second error. The context might be deployed partially.',
      )
    })

    it('should throw the correct error when it is not CMBD error', async () => {
      connection.put.mockRejectedValueOnce(new Error('error'))
      await expect(
        deployAssetObjectContext(toChange({ after: contextInstance1 }), client, config),
      ).rejects.toThrowWithMessage(
        Error,
        'Failed to deploy asset object field configuration for instance jira.CustomFieldContext.instance.context1 with error: Failed to put rest/servicedesk/cmdb/latest/fieldconfig/55555 with error: error. The context might be deployed partially.',
      )
    })
  })
})
