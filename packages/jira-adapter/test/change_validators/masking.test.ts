/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { toChange, ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { MASK_VALUE } from '../../src/filters/masking'
import { DETAILED_MESSAGE, DOCUMENTATION_URL, maskingValidator } from '../../src/change_validators/masking'
import { AUTOMATION_TYPE, JIRA } from '../../src/constants'
import { mockClient } from '../utils'
import JiraClient from '../../src/client/client'

describe('maskingValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  let client: JiraClient

  beforeEach(() => {
    client = mockClient().client
    type = new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) })
    instance = new InstanceElement(
      'instance',
      type,
      {
        headers: [
          {
            name: 'masked',
            value: MASK_VALUE,
          },
          {
            name: 'notMasked',
            value: 'value',
          },
        ],
      }
    )
  })

  it('should return the service URL when have one', async () => {
    instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = 'http://url'

    expect(await maskingValidator(client)([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Masked data will be deployed to the service',
        detailedMessage: DETAILED_MESSAGE,
        deployActions: {
          postAction: {
            title: 'Update deployed masked data',
            description: 'Please update the masked values that were deployed to Jira in jira.Automation.instance.instance',
            subActions: [
              'Go to http://url',
              'Search for masked values (which contain <SECRET_TOKEN>) and set them to the correct value',
              'Save the page',
            ],
            documentationURL: DOCUMENTATION_URL,
          },
        },
      },
    ])
  })

  it('should return a warning if have a masked value', async () => {
    expect(await maskingValidator(client)([
      toChange({
        before: instance,
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Masked data will be deployed to the service',
        detailedMessage: DETAILED_MESSAGE,
        deployActions: {
          postAction: {
            title: 'Update deployed masked data',
            description: 'Please update the masked values that were deployed to Jira in jira.Automation.instance.instance',
            subActions: [
              'Go to https://ori-salto-test.atlassian.net/ and open the relevant page for jira.Automation.instance.instance',
              'Search for masked values (which contain <SECRET_TOKEN>) and set them to the correct value',
              'Save the page',
            ],
            documentationURL: DOCUMENTATION_URL,
          },
        },
      },
    ])
  })

  it('should not return an info have a masked value', async () => {
    instance.value.headers = {
      name: 'notMasked',
      value: 'value',
    }
    expect(await maskingValidator(client)([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
})
