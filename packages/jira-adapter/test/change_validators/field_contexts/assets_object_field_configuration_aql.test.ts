/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { CORE_ANNOTATIONS, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { createEmptyType, mockClient } from '../../utils'
import { assetsObjectFieldConfigurationAqlValidator } from '../../../src/change_validators/field_contexts/assets_object_field_configuration_aql'
import JiraClient from '../../../src/client/client'

describe('assetsObjectFieldConfigurationAql', () => {
  let contextInstance: InstanceElement
  let fieldInstance: InstanceElement
  let client: JiraClient

  beforeEach(() => {
    const mockCli = mockClient()
    client = mockCli.client
    fieldInstance = new InstanceElement('field', createEmptyType('Field'), { id: 'customfield_10000' })
    contextInstance = new InstanceElement(
      'context',
      createEmptyType('CustomFieldContext'),
      {
        name: 'context',
        assetsObjectFieldConfiguration: {
          issueScopeFilterQuery:
            // eslint-disable-next-line no-template-curly-in-string
            'object HAVING inboundReferences(objecttype = Server AND objectId IN (${customfield_14168${0}}))',
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
      },
    )
  })

  it('should return warning for AQL with placeholder when field parent has id', async () => {
    const result = await assetsObjectFieldConfigurationAqlValidator(client)([toChange({ after: contextInstance })])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      elemID: contextInstance.elemID.createNestedID('assetsObjectFieldConfiguration', 'issueScopeFilterQuery'),
      severity: 'Warning',
      message: 'AQL placeholders are not supported.',
      detailedMessage:
        'This AQL expression will be deployed as is. You may need to manually edit the ids later to match the target environment.',
      deployActions: {
        postAction: {
          title: 'Edit AQL placeholders manually',
          subActions: [
            'Go to https://ori-salto-test.atlassian.net/secure/admin/ConfigureCustomField!default.jspa?customFieldId=10000',
            'Under the context "context", click on "Edit Assets object/s field configuration"',
            'Inside "Filter issue scope" section, fix the placeholder with the correct value',
            'Click "Save"',
          ],
        },
      },
    })
  })
  it('should return warning for AQL with placeholder when field parent has no id', async () => {
    const fieldInstanceWithoutId = new InstanceElement('field', createEmptyType('Field'), { name: 'field2' })
    contextInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(fieldInstanceWithoutId.elemID, fieldInstanceWithoutId),
    ]
    const result = await assetsObjectFieldConfigurationAqlValidator(client)([toChange({ after: contextInstance })])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      elemID: contextInstance.elemID.createNestedID('assetsObjectFieldConfiguration', 'issueScopeFilterQuery'),
      severity: 'Warning',
      message: 'AQL placeholders are not supported.',
      detailedMessage:
        'This AQL expression will be deployed as is. You may need to manually edit the ids later to match the target environment.',
      deployActions: {
        postAction: {
          title: 'Edit AQL placeholders manually',
          subActions: [
            'Go to field2 field configuration',
            'Under the context "context", click on "Edit Assets object/s field configuration"',
            'Inside "Filter issue scope" section, fix the placeholder with the correct value',
            'Click "Save"',
          ],
        },
      },
    })
  })

  it('should not return warning for AQL without placeholder', async () => {
    contextInstance.value.assetsObjectFieldConfiguration.issueScopeFilterQuery =
      'object HAVING inboundReferences(objecttype = Server AND objectId IN (customfield_14168))'
    const result = await assetsObjectFieldConfigurationAqlValidator(client)([toChange({ after: contextInstance })])
    expect(result).toHaveLength(0)
  })

  it('should do nothing for non context changes', async () => {
    const result = await assetsObjectFieldConfigurationAqlValidator(client)([
      toChange({ after: createEmptyType('Field') }),
    ])
    expect(result).toHaveLength(0)
  })

  it('should do nothing for context without assetsObjectFieldConfiguration', async () => {
    contextInstance.value.assetsObjectFieldConfiguration = undefined
    const result = await assetsObjectFieldConfigurationAqlValidator(client)([toChange({ after: contextInstance })])
    expect(result).toHaveLength(0)
  })

  it('should do nothing for context without issueScopeFilterQuery', async () => {
    contextInstance.value.assetsObjectFieldConfiguration.issueScopeFilterQuery = undefined
    const result = await assetsObjectFieldConfigurationAqlValidator(client)([toChange({ after: contextInstance })])
    expect(result).toHaveLength(0)
  })
  it('should do nothing for context with invalid parent', async () => {
    contextInstance.annotations[CORE_ANNOTATIONS.PARENT] = []
    const result = await assetsObjectFieldConfigurationAqlValidator(client)([toChange({ after: contextInstance })])
    expect(result).toHaveLength(0)
  })
})
