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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { BRAND_TYPE_NAME, GUIDE_THEME_TYPE_NAME, THEME_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'
import { FilterCreator } from '../../src/filter'
import filterCreator from '../../src/filters/guide_theme_settings'
import * as PublishModule from '../../src/filters/guide_themes/publish'
import { createFilterCreatorParams } from '../utils'

const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
const themeType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_THEME_TYPE_NAME) })
const themeSettingsType = new ObjectType({
  elemID: new ElemID(ZENDESK, THEME_SETTINGS_TYPE_NAME),
  fields: {
    brand: { refType: BuiltinTypes.NUMBER },
    liveTheme: { refType: BuiltinTypes.STRING },
  },
  path: [ZENDESK, 'Types', THEME_SETTINGS_TYPE_NAME],
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  },
})

const brand1 = new InstanceElement('brand', brandType, { id: 1, name: 'oneTwo', has_help_center: true })
const liveTheme = new InstanceElement('theme', themeType, {
  id: 'park?',
  name: 'SixFlags',
  brand_id: new ReferenceExpression(brand1.elemID, brand1),
  live: true,
})
const nonLiveTheme = new InstanceElement('theme', themeType, {
  id: 'park?2',
  name: 'SixFlags',
  brand_id: new ReferenceExpression(brand1.elemID, brand1),
  live: false,
})
const brand2 = new InstanceElement('brand2', brandType, { id: 2, name: 'oneTwo', has_help_center: true })
const liveTheme2 = new InstanceElement('theme2', themeType, {
  id: 'park?3',
  name: 'SixFlags',
  brand_id: new ReferenceExpression(brand2.elemID, brand2),
  live: true,
})

const themeSettingsInstance = new InstanceElement(`${brand1.value.name}_settings`, themeSettingsType, {
  brand: new ReferenceExpression(brand1.elemID),
  liveTheme: new ReferenceExpression(liveTheme.elemID),
})
const themeSettingsInstance2 = new InstanceElement(`${brand2.value.name}_settings`, themeSettingsType, {
  brand: new ReferenceExpression(brand2.elemID),
  liveTheme: new ReferenceExpression(liveTheme2.elemID),
})

describe('filterCreator', () => {
  describe('fetch', () => {
    describe('bad config', () => {
      it('returns undefined if guide is not enabled', async () => {
        expect(await filterCreator(createFilterCreatorParams({})).onFetch?.([brand1, liveTheme])).toBeUndefined()
      })
      describe('guide is enabled but themes is not', () => {
        let filter: ReturnType<FilterCreator>

        beforeEach(() => {
          const config = { ...DEFAULT_CONFIG }
          config[FETCH_CONFIG].guide = { brands: ['.*'], themesForBrands: [] }
          filter = filterCreator(createFilterCreatorParams({ config }))
        })

        it('returns undefined', async () => {
          expect(await filter.onFetch?.([brand1, liveTheme])).toBeUndefined()
        })
      })
    })

    describe('good config', () => {
      let filter: ReturnType<FilterCreator>

      beforeEach(() => {
        const config = { ...DEFAULT_CONFIG }
        config[FETCH_CONFIG].guide = { brands: ['.*'], themesForBrands: ['.*'] }
        filter = filterCreator(createFilterCreatorParams({ config }))
      })

      it('should creates setting instance and type correctly', async () => {
        const elements = [brand1, liveTheme, nonLiveTheme, brand2, liveTheme2, themeSettingsType]
        await filter.onFetch?.(elements)
        expect(elements).toEqual([
          brand1,
          liveTheme,
          nonLiveTheme,
          brand2,
          liveTheme2,
          themeSettingsType,
          themeSettingsInstance,
          themeSettingsInstance2,
        ])
      })
      it('should not creates setting instance and type if there is no live theme', async () => {
        const elements = [brand1, nonLiveTheme]
        await filter.onFetch?.(elements)
        expect(elements).toEqual([brand1, nonLiveTheme])
      })
    })
  })

  describe('deploy', () => {
    let filter: ReturnType<FilterCreator>
    let mockPublish: jest.SpyInstance

    beforeEach(() => {
      jest.resetAllMocks()
      const config = { ...DEFAULT_CONFIG }
      config[FETCH_CONFIG].guide = { brands: ['.*'], themesForBrands: ['.*'] }
      filter = filterCreator(createFilterCreatorParams({ config }))
      mockPublish = jest.spyOn(PublishModule, 'publish')
    })
    it('should succeed on modification changes', async () => {
      mockPublish.mockResolvedValue([])
      const afterSetting = themeSettingsInstance.clone()
      afterSetting.value.liveTheme = 'park?2'
      const changes = [toChange({ before: themeSettingsInstance, after: afterSetting })]
      const deployResults = await filter.deploy?.(changes)

      expect(mockPublish).toHaveBeenCalledTimes(1)
      expect(deployResults?.deployResult.errors).toHaveLength(0)
      expect(deployResults?.deployResult.appliedChanges).toMatchObject(changes)
    })
    it('should fail on addition and deletion changes', async () => {
      mockPublish.mockResolvedValue([])
      const changes = [toChange({ before: themeSettingsInstance }), toChange({ after: themeSettingsInstance2 })]
      const deployResults = await filter.deploy?.(changes)

      expect(mockPublish).toHaveBeenCalledTimes(0)
      expect(deployResults?.deployResult.errors).toHaveLength(2)
      expect(deployResults?.deployResult.errors).toEqual([
        {
          elemID: themeSettingsInstance.elemID,
          message: 'Theme_settings instances cannot be added or removed',
          severity: 'Error',
        },
        {
          elemID: themeSettingsInstance2.elemID,
          message: 'Theme_settings instances cannot be added or removed',
          severity: 'Error',
        },
      ])
      expect(deployResults?.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should fail when publish returns error', async () => {
      mockPublish.mockResolvedValue(['err'])
      const afterSetting = themeSettingsInstance.clone()
      afterSetting.value.liveTheme = 'park?2'
      const changes = [toChange({ before: themeSettingsInstance, after: afterSetting })]
      const deployResults = await filter.deploy?.(changes)

      expect(mockPublish).toHaveBeenCalledTimes(1)
      expect(deployResults?.deployResult.errors).toHaveLength(1)
      expect(deployResults?.deployResult.errors).toEqual([
        {
          elemID: afterSetting.elemID,
          message: 'err',
          severity: 'Error',
        },
      ])
      expect(deployResults?.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
