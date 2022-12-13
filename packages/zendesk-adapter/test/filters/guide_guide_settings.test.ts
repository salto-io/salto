/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { filterUtils } from '@salto-io/adapter-components'
import {
  BuiltinTypes,
  ElemID, Field,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import filterCreator, {
  GUIDE_SETTINGS_PREFERENCE_TYPE,
  HELP_CENTER_TYPE,
} from '../../src/filters/guide_guide_settings'
import { createFilterCreatorParams } from '../utils'
import ZendeskClient from '../../src/client/client'


describe('guide_settings filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType

  const guideSettingsTypeName = 'guide_settings'
  const guideSettingsType = new ObjectType({ elemID: new ElemID(ZENDESK, guideSettingsTypeName) })
  const guideSettingsPreferencesType = new ObjectType(
    { elemID: new ElemID(ZENDESK, GUIDE_SETTINGS_PREFERENCE_TYPE) }
  )
  const guideSettingsHelpCenterValideType = new ObjectType({
    elemID: new ElemID(ZENDESK, HELP_CENTER_TYPE),
    fields: {
      text_filter: { refType: BuiltinTypes.UNKNOWN },
    },
  })
  guideSettingsHelpCenterValideType.fields.general_settings_attributes = new Field(
    guideSettingsHelpCenterValideType,
    'general_settings_attributes',
    guideSettingsPreferencesType,
  )
  const validGuideSettingsInstance = new InstanceElement(
    'instance',
    guideSettingsType,
    {
      help_center: {
        text_filter: {
          content: 'x',
        },
        general_settings_attributes: {
          agent_requests_enabled: false,
          anonymous_kb_voting_enabled: false,
          article_sanitization_disabled: false,
          at_mentions_enabled: true,
          community_badges_shown: false,
          community_enabled: true,
        },
      },
    }
  )

  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'brandWithHC' },
    })
    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  describe('onFetch', () => {
    it('should turn guide settings to be in valid form onFetch', async () => {
      const invalidGuideSettingsInstance = new InstanceElement(
        'instance',
        guideSettingsType,
        {
          help_center: {
            text_filter: {
              content: 'x',
            },
            settings: {
              preferences: {
                agent_requests_enabled: false,
                anonymous_kb_voting_enabled: false,
                article_sanitization_disabled: false,
                at_mentions_enabled: true,
                community_badges_shown: false,
                community_enabled: true,
              },
            },
          },
        }
      )
      const guideSettingsHelpCenterInvalideType = new ObjectType({
        elemID: new ElemID(ZENDESK, HELP_CENTER_TYPE),
        fields: {
          settings: { refType: BuiltinTypes.UNKNOWN },
          text_filter: { refType: BuiltinTypes.UNKNOWN },
        },
      })
      await filter.onFetch(
        [
          invalidGuideSettingsInstance,
          guideSettingsHelpCenterInvalideType,
          guideSettingsPreferencesType,
        ]
      )
      expect(invalidGuideSettingsInstance.value).toEqual(validGuideSettingsInstance.value)
      expect(guideSettingsHelpCenterInvalideType).toEqual(guideSettingsHelpCenterValideType)
    })
  })
})
