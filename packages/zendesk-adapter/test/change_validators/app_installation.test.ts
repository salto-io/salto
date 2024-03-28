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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import { APP_INSTALLATION_TYPE_NAME, ZENDESK } from '../../src/constants'
import { appInstallationValidator, createChangeError } from '../../src/change_validators/app_installation'

describe('appInstallationValidator', () => {
  let client: ZendeskClient
  let mockGet: jest.SpyInstance

  const appInstallation = new InstanceElement(
    ElemID.CONFIG_NAME,
    new ObjectType({ elemID: new ElemID(ZENDESK, APP_INSTALLATION_TYPE_NAME) }),
    {
      app_id: 1234,
      name: 'test_app_ins',
      settings: {
        name: 'hello',
        second_field: 1234,
      },
    },
  )
  beforeEach(async () => {
    jest.clearAllMocks()
  })
  beforeAll(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
  })

  it('Should return an error when there are missing fields', async () => {
    mockGet = jest.spyOn(client, 'get')
    mockGet.mockImplementation(params => {
      if (params.url === `/api/support/apps/${appInstallation.value.app_id}/installations/new`) {
        return {
          status: 200,
          data: {
            installation: {
              settings: [
                { key: 'name', secure: false, required: true, type: 'text' },
                { key: 'second_field', secure: false, required: true, type: 'number' },
                { key: 'third_field', secure: false, required: false, type: 'text' },
                { key: 'fourth_field', secure: true, required: true, type: 'number' },
                { key: 'last_field', secure: true, required: true, type: 'text' },
              ],
            },
          },
        }
      }
      throw new Error('Err')
    })

    const cv = appInstallationValidator(client)
    const errors = await cv([toChange({ after: appInstallation })])
    expect(errors).toEqual([
      createChangeError(appInstallation.elemID, ['fourth_field', 'last_field'], client.getUrl().href),
    ])
  })
  it('Should not return errors when there are no missing fields', async () => {
    mockGet = jest.spyOn(client, 'get')
    mockGet.mockImplementation(params => {
      if (params.url === `/api/support/apps/${appInstallation.value.app_id}/installations/new`) {
        return {
          status: 200,
          data: {
            installation: {
              settings: [
                { key: 'name', secure: false, required: true, type: 'text' },
                { key: 'second_field', secure: false, required: true, type: 'number' },
                { key: 'third_field', secure: false, required: false, type: 'text' },
              ],
            },
          },
        }
      }
      throw new Error('Err')
    })

    const cv = appInstallationValidator(client)
    const errors = await cv([toChange({ after: appInstallation })])
    expect(errors).toEqual([])
  })
})
