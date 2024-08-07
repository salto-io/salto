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

import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { createEmptyType } from '../../utils'
import { assetsObjectFieldConfigurationAqlValidator } from '../../../src/change_validators/field_contexts/assets_object_field_configuration_aql'

describe('assetsObjectFieldConfigurationAql', () => {
  let contextInstance: InstanceElement
  beforeEach(() => {
    contextInstance = new InstanceElement('context', createEmptyType('CustomFieldContext'), {
      name: 'context',
      assetsObjectFieldConfiguration: {
        issueScopeFilterQuery:
          // eslint-disable-next-line no-template-curly-in-string
          'object HAVING inboundReferences(objecttype = Server AND objectId IN (${customfield_14168${0}}))',
      },
    })
  })

  it('should return warning for AQL with placeholder', async () => {
    const result = await assetsObjectFieldConfigurationAqlValidator([toChange({ after: contextInstance })])
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
            'In Jira, navigate to the field context "context" > Edit Assets object/s field configuration',
            'Inside Filter issue scope section, fix the placeholder with the correct value',
            'Click "Save"',
          ],
        },
      },
    })
  })

  it('should not return warning for AQL without placeholder', async () => {
    contextInstance.value.assetsObjectFieldConfiguration.issueScopeFilterQuery =
      'object HAVING inboundReferences(objecttype = Server AND objectId IN (customfield_14168))'
    const result = await assetsObjectFieldConfigurationAqlValidator([toChange({ after: contextInstance })])
    expect(result).toHaveLength(0)
  })

  it('should do nothing for non context changes', async () => {
    const result = await assetsObjectFieldConfigurationAqlValidator([toChange({ after: createEmptyType('Field') })])
    expect(result).toHaveLength(0)
  })

  it('should do nothing for context without assetsObjectFieldConfiguration', async () => {
    contextInstance.value.assetsObjectFieldConfiguration = undefined
    const result = await assetsObjectFieldConfigurationAqlValidator([toChange({ after: contextInstance })])
    expect(result).toHaveLength(0)
  })

  it('should do nothing for context without issueScopeFilterQuery', async () => {
    contextInstance.value.assetsObjectFieldConfiguration.issueScopeFilterQuery = undefined
    const result = await assetsObjectFieldConfigurationAqlValidator([toChange({ after: contextInstance })])
    expect(result).toHaveLength(0)
  })
})
