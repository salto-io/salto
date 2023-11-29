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
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../../src/config/config'
import assetsStatusAdditionFilter from '../../../src/filters/assets/assets_status_addition'
import { createEmptyType, getFilterParams } from '../../utils'
import { ASSESTS_SCHEMA_TYPE, ASSETS_STATUS_TYPE } from '../../../src/constants'

describe('assetsStatusAddition', () => {
    type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
    let filter: FilterType
    let assetsStatusInstance: InstanceElement
    const assetSchemaInstance = new InstanceElement(
      'assetsSchema1',
      createEmptyType(ASSESTS_SCHEMA_TYPE),
      {
        id: 5,
        name: 'assetsSchema',
      },
    )
    describe('preDeploy', () => {
      beforeEach(async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        config.fetch.enableJsmExperimental = true
        filter = assetsStatusAdditionFilter(getFilterParams({ config })) as typeof filter
        assetsStatusInstance = new InstanceElement(
          'assetsStatusInstance',
          createEmptyType(ASSETS_STATUS_TYPE),
          {
            name: 'assetsStatusInstance',
            description: 'test Description',
            category: 2,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
          }
        )
      })
      it('should add objectSchemaId on addition', async () => {
        await filter.preDeploy([{ action: 'add', data: { after: assetsStatusInstance } }])
        expect(assetsStatusInstance.value.objectSchemaId).toEqual(5)
      })
    })
    describe('onDeploy', () => {
      beforeEach(async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        config.fetch.enableJsmExperimental = true
        filter = assetsStatusAdditionFilter(getFilterParams({ config })) as typeof filter
        assetsStatusInstance = new InstanceElement(
          'assetsStatusInstance',
          createEmptyType(ASSETS_STATUS_TYPE),
          {
            name: 'assetsStatusInstance',
            description: 'test Description',
            category: 2,
            objectSchemaId: 5,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
          }
        )
      })
      it('should delete objectSchemaId', async () => {
        await filter.onDeploy([{ action: 'add', data: { after: assetsStatusInstance } }])
        expect(assetsStatusInstance.value.objectSchemaId).toBeUndefined()
      })
    })
})
