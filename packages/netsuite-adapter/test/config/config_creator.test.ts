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
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { InstanceLimiterFunc, configType } from '../../src/config/types'
import { instanceLimiterCreator, netsuiteConfigFromConfig, fullFetchConfig } from '../../src/config/config_creator'
import { DEFAULT_MAX_INSTANCES_VALUE, UNLIMITED_INSTANCES_VALUE } from '../../src/config/constants'

describe('netsuite config creator', () => {
  let config: InstanceElement

  beforeEach(async () => {
    config = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)
  })

  it('should return config when config instance is undefined', () => {
    expect(netsuiteConfigFromConfig(undefined)).toEqual({
      fetch: fullFetchConfig(),
    })
  })

  describe('fetch target', () => {
    it('should keep query without custom records', () => {
      config.value.fetchTarget = {
        types: {
          addressForm: ['aaa.*', 'bbb.*'],
        },
        filePaths: ['eee.*', 'fff.*'],
      }
      expect(netsuiteConfigFromConfig(config).fetchTarget).toEqual({
        types: {
          addressForm: ['aaa.*', 'bbb.*'],
        },
        filePaths: ['eee.*', 'fff.*'],
      })
    })
    it('should add custom record types to "types"', () => {
      config.value.fetchTarget = {
        types: {
          addressForm: ['aaa.*', 'bbb.*'],
          customrecordtype: ['customrecord2'],
        },
        customRecords: {
          customrecord1: ['.*'],
        },
      }
      expect(netsuiteConfigFromConfig(config).fetchTarget).toEqual({
        types: {
          addressForm: ['aaa.*', 'bbb.*'],
          customrecordtype: ['customrecord2', 'customrecord1'],
          customsegment: [],
        },
        customRecords: {
          customrecord1: ['.*'],
        },
      })
    })
    it('should generate "types" when query includes only custom records', () => {
      config.value.fetchTarget = {
        customRecords: {
          customrecord1: ['.*'],
        },
      }
      expect(netsuiteConfigFromConfig(config).fetchTarget).toEqual({
        types: {
          customrecordtype: ['customrecord1'],
          customsegment: [],
        },
        customRecords: {
          customrecord1: ['.*'],
        },
      })
    })
    it('should include customsegment too', () => {
      config.value.fetchTarget = {
        customRecords: {
          customrecord_cseg1: ['.*'],
        },
      }
      expect(netsuiteConfigFromConfig(config).fetchTarget).toEqual({
        types: {
          customrecordtype: ['customrecord_cseg1'],
          customsegment: ['cseg1'],
        },
        customRecords: {
          customrecord_cseg1: ['.*'],
        },
      })
    })
  })

  describe('instance limiter', () => {
    const overDefault = DEFAULT_MAX_INSTANCES_VALUE + 1
    const underDefault = DEFAULT_MAX_INSTANCES_VALUE - 1

    describe('with maxInstancesPerType in the config', () => {
      let limiter: InstanceLimiterFunc

      beforeAll(() => {
        limiter = instanceLimiterCreator({ maxInstancesPerType: [
          { name: 'customsegment', limit: 30 },
          { name: 'customsegment', limit: 6000 },
          { name: 'unlimited', limit: UNLIMITED_INSTANCES_VALUE },
          { name: 'savedsearch', limit: 50_000 },
        ] })
      })

      it('should apply limit only if over the default', () => {
        expect(limiter('customsegment', 31)).toBeFalsy()
      })

      it('should limit according to type if exists and over default', () => {
        expect(limiter('customsegment', 6001)).toBeTruthy()
        expect(limiter('customsegment', 5999)).toBeFalsy()
      })

      it('should limit according to default if type does not exist', () => {
        expect(limiter('test', overDefault)).toBeTruthy()
        expect(limiter('test', underDefault)).toBeFalsy()
      })

      it('should not limit at all if the type is unlimited', () => {
        expect(limiter('unlimited', 100_000_000)).toBeFalsy()
      })

      it('should limit to the highest match if multiple exist (also from default definition)', () => {
        expect(limiter('savedsearch', 30_000)).toBeFalsy()
        expect(limiter('savedsearch', 60_000)).toBeTruthy()
      })
    })

    describe('without maxInstancesPerType in the config', () => {
      let limiter: InstanceLimiterFunc

      beforeAll(() => {
        limiter = instanceLimiterCreator({})
      })

      it('should limit according to type if exists', () => {
        expect(limiter('customrecord_type', 10_001)).toBeTruthy()
        expect(limiter('customrecord_type', 9999)).toBeFalsy()
      })

      it('should limit according to default if type does not exist', () => {
        expect(limiter('test', overDefault)).toBeTruthy()
        expect(limiter('test', underDefault)).toBeFalsy()
      })
    })

    it('should limit according to default if no parameter is given', () => {
      const limiter = instanceLimiterCreator()

      expect(limiter('test', overDefault)).toBeTruthy()
      expect(limiter('test', underDefault)).toBeFalsy()
    })

    it('should limit according to the largest matching limit', () => {
      const limiter = instanceLimiterCreator({
        maxInstancesPerType: [
          { name: 'customsegment', limit: 8000 },
          { name: 'custom.*', limit: 7000 },
          { name: '.*', limit: 6000 },
        ],
      })
      expect(limiter('customsegment', 7999)).toBeFalsy()
      expect(limiter('customsegment', 8001)).toBeTruthy()

      expect(limiter('customlist', 6999)).toBeFalsy()
      expect(limiter('customlist', 7001)).toBeTruthy()

      expect(limiter('test', 5999)).toBeFalsy()
      expect(limiter('test', 6001)).toBeTruthy()
    })
  })
})
