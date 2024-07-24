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

import { ElemID, ServiceIds } from '@salto-io/adapter-api'
import { CUSTOM_METADATA, CUSTOM_METADATA_TYPE_NAME, SALESFORCE } from '../src/constants'
import { Types } from '../src/transformers/transformer'
import { FETCH_CONFIG } from '../src/types'
import mockAdapter from './adapter'

// TODO (SALTO-6264): Remove this file once hide types is enabled.
describe('Salesforce adapter constructor', () => {
  describe('getElemIdFunc', () => {
    const placeholderElemID = new ElemID(SALESFORCE, 'placeholder')

    beforeEach(() => {
      Types.setElemIdGetter(() => placeholderElemID)
    })

    describe('when meta types are disabled and no function is passed', () => {
      beforeEach(() => {
        mockAdapter()
      })

      it('should return the placeholder elem ID', () => {
        expect(Types.getElemId(CUSTOM_METADATA, true, {})).toEqual(placeholderElemID)
      })
    })

    describe('when meta types are disabled and a function is passed', () => {
      beforeEach(() => {
        mockAdapter({
          adapterParams: {
            getElemIdFunc: (adapterName: string, _serviceIds: ServiceIds, name: string): ElemID =>
              new ElemID(`${adapterName}2`, name),
          },
        })
      })

      it('should return an altered elem ID', () => {
        expect(Types.getElemId(CUSTOM_METADATA, true, {})).toEqual(new ElemID(`${SALESFORCE}2`, CUSTOM_METADATA))
      })
    })

    describe('when meta types are enabled and no function is passed', () => {
      beforeEach(() => {
        mockAdapter({
          adapterParams: {
            config: {
              [FETCH_CONFIG]: {
                optionalFeatures: {
                  metaTypes: true,
                },
              },
            },
          },
        })
      })

      it('should return a renamed elem ID', () => {
        expect(Types.getElemId(CUSTOM_METADATA, true, {})).toEqual(new ElemID(SALESFORCE, CUSTOM_METADATA_TYPE_NAME))
      })
    })

    describe('when meta types are enabled and a function is passed', () => {
      beforeEach(() => {
        mockAdapter({
          adapterParams: {
            getElemIdFunc: (adapterName: string, _serviceIds: ServiceIds, name: string): ElemID =>
              new ElemID(`${adapterName}2`, name),
            config: {
              [FETCH_CONFIG]: {
                optionalFeatures: {
                  metaTypes: true,
                },
              },
            },
          },
        })
      })

      it('should return a renamed and altered elem ID', () => {
        expect(Types.getElemId(CUSTOM_METADATA, true, {})).toEqual(
          new ElemID(`${SALESFORCE}2`, CUSTOM_METADATA_TYPE_NAME),
        )
      })
    })
  })
})
