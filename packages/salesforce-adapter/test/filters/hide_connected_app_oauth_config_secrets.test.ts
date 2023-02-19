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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/hide_connected_app_oauth_config_secrets'
import { CONNECTED_APP_OAUTH_CONFIG_METADATA_TYPE, METADATA_TYPE } from '../../src/constants'

const filter = filterCreator()

describe(filter.name, () => {
  let connectedAppOauthConfigType: ObjectType

  beforeEach(async () => {
    connectedAppOauthConfigType = new ObjectType({
      elemID: new ElemID('salesforce', CONNECTED_APP_OAUTH_CONFIG_METADATA_TYPE),
      fields: {
        consumerKey: {
          refType: BuiltinTypes.STRING,
        },
        consumerSecret: {
          refType: BuiltinTypes.STRING,
        },
      },
      annotations: {
        [METADATA_TYPE]: CONNECTED_APP_OAUTH_CONFIG_METADATA_TYPE,
      },
    })
    await filter.onFetch([connectedAppOauthConfigType])
  })

  it('should annotate secret fields with core _hidden_value', () => {
    expect(connectedAppOauthConfigType.fields).toEqual(expect.objectContaining({
      consumerKey: expect.objectContaining({
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      }),
      consumerSecret: expect.objectContaining({
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      }),
    }))
  })
})
