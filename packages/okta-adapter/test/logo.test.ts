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

import {
  ElemID,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ObjectType,
  InstanceElement,
  ReferenceExpression,
  StaticFile,
  toChange,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { TYPES_PATH, SUBTYPES_PATH, RECORDS_PATH } from '@salto-io/adapter-components/src/elements_deprecated'
import OktaClient from '../src/client/client'
import { APPLICATION_TYPE_NAME, APP_LOGO_TYPE_NAME, LINKS_FIELD, OKTA } from '../src/constants'
import { createFileType, deployLogo, getLogo } from '../src/logo'
import { mockClient } from './utils'

describe('logo filter', () => {
  const content = Buffer.from('test')
  let mockGet: jest.SpyInstance
  let client: OktaClient
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const appInstance = new InstanceElement(
    'app1',
    appType,
    {
      id: '11',
      label: 'app1',
      [LINKS_FIELD]: {
        logo: [
          {
            name: 'fileName',
            href: 'https://ok12static.oktacdn.com/fs/bco/4/111',
            type: 'image/png',
          },
        ],
      },
    },
    [OKTA, RECORDS_PATH, APPLICATION_TYPE_NAME, 'app1', 'app1'],
  )
  const contentType = 'png'
  const fileName = 'app1'
  const link = 'https://ok12static.oktacdn.com/fs/bco/4/111'
  const appLogoType = new ObjectType({ elemID: new ElemID(OKTA, APP_LOGO_TYPE_NAME) })
  describe('createFileType', () => {
    it('should create logo type', () => {
      const logoType = createFileType(APP_LOGO_TYPE_NAME)
      expect(logoType.elemID.name).toEqual(APP_LOGO_TYPE_NAME)
      expect(logoType).toEqual(
        new ObjectType({
          elemID: new ElemID(OKTA, APP_LOGO_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.STRING,
              annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
            },
            content: { refType: BuiltinTypes.STRING },
            contentType: { refType: BuiltinTypes.STRING },
            fileName: { refType: BuiltinTypes.STRING },
          },
          path: [OKTA, TYPES_PATH, SUBTYPES_PATH, APP_LOGO_TYPE_NAME, APP_LOGO_TYPE_NAME],
        }),
      )
    })
  })
  describe('getLogo', () => {
    beforeEach(async () => {
      const mockCli = mockClient()
      client = mockCli.client
      mockGet = jest.spyOn(client, 'getResource')
      mockGet.mockImplementation(params => {
        if (params.url === 'https://ok12static.oktacdn.com/fs/bco/4/111') {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
    })
    it('should return logo', async () => {
      const logo = (await getLogo({
        client,
        parents: [appInstance],
        logoType: appLogoType,
        contentType,
        logoName: fileName,
        link,
      })) as InstanceElement
      expect(logo?.value).toEqual({
        id: '111',
        fileName: `${fileName}.${contentType}`,
        contentType,
        content: new StaticFile({
          filepath: 'okta/AppLogo/app1.png',
          encoding: 'binary',
          content,
        }),
      })
      expect(logo?.annotations[CORE_ANNOTATIONS.PARENT]).toHaveLength(1)
      expect(logo?.annotations[CORE_ANNOTATIONS.PARENT]).toContainEqual(
        new ReferenceExpression(appInstance.elemID, appInstance),
      )
      expect(logo?.path).toEqual([OKTA, RECORDS_PATH, 'AppLogo', fileName])
    })
    it('should return logo with nested path', async () => {
      const logo = (await getLogo({
        client,
        parents: [appInstance],
        logoType: appLogoType,
        contentType,
        logoName: fileName,
        link,
        nestedPath: appInstance.path?.slice(2, appInstance.path?.length - 1) ?? [],
      })) as InstanceElement
      expect(logo.path).toEqual([OKTA, RECORDS_PATH, 'Application', 'app1', 'AppLogo', fileName])
    })
    it('should return error when content is not buffer', async () => {
      mockGet.mockImplementationOnce(() => {
        throw new Error('Err')
      })
      const res = await getLogo({
        client,
        parents: [appInstance],
        logoType: appLogoType,
        contentType,
        logoName: fileName,
        link,
      })
      expect(res).toEqual(new Error('Failed to fetch attachment content from Okta API'))
    })
  })
  describe('deploy logo', () => {
    let mockConnection: MockInterface<clientUtils.APIConnection>
    const appLogoInstance = new InstanceElement(
      'app1',
      appLogoType,
      {
        id: '111',
        fileName: `${fileName}.${contentType}`,
        contentType,
        content: new StaticFile({
          filepath: 'okta/AppLogo/app1.png',
          encoding: 'binary',
          content,
        }),
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appInstance.elemID, appInstance)],
      },
    )
    beforeEach(() => {
      jest.clearAllMocks()
      const { client: cli, connection } = mockClient()
      mockConnection = connection
      client = cli
    })
    it('should call send Logo Request', async () => {
      const mockPost = mockConnection.post
      const appLogoChange = toChange({ after: appLogoInstance })
      await deployLogo(appLogoChange, client)
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith('/api/v1/apps/11/logo', expect.anything(), expect.anything())
    })
    it('should throw in case of error', async () => {
      const mockPost = mockConnection.post
      mockPost.mockRejectedValue(
        new clientUtils.HTTPError('message', {
          status: 400,
          data: {
            errorSummary: 'some okta error',
            errorCauses: [{ errorSummary: 'cause1' }, { errorSummary: 'cause2' }],
          },
        }),
      )
      const appLogoChange = toChange({ after: appLogoInstance })
      await expect(() => deployLogo(appLogoChange, client)).rejects.toThrow(
        new Error('some okta error. More info: cause1,cause2 (status code: 400)'),
      )
    })
    it('should call send Logo Request with removal', async () => {
      const mockDelete = mockConnection.delete
      const appLogoChange = toChange({ before: appLogoInstance })
      await deployLogo(appLogoChange, client)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledWith('/api/v1/apps/11/logo', undefined)
    })
    it('should allow 404 status when removing a logo', async () => {
      const mockDelete = mockConnection.delete
      mockDelete.mockRejectedValue(
        new clientUtils.HTTPError('message', {
          status: 404,
          data: {},
        }),
      )
      const appLogoChange = toChange({ before: appLogoInstance })
      await deployLogo(appLogoChange, client)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledWith('/api/v1/apps/11/logo', undefined)
    })
  })
})
