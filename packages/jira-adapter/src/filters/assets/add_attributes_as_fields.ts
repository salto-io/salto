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

import { ReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { ASSETS_ATTRIBUTE_TYPE } from '../../constants'

/* This filter adds the attributes as fields to the AssetsObjectType that created them.
* The filter also removes the attributes from their parent asset schema.
*/
const filter: FilterCreator = ({ config }) => ({
  name: 'addAttributesAsFieldsFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM || !config.fetch.enableJsmExperimental) {
      return
    }
    const attributes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ASSETS_ATTRIBUTE_TYPE)
    const attributesByAssetObjectTypeName = _.groupBy(attributes,
      attribute => attribute.value.objectType.elemID.getFullName())

    Object.values(attributesByAssetObjectTypeName).forEach(assetAttributes => {
      const assetsObjectType = assetAttributes[0].value.objectType.value
      assetsObjectType.value.attributes = assetAttributes.map(attribute =>
        new ReferenceExpression(attribute.elemID, attribute))
    })

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === 'AssetsSchema')
      .forEach(instance => {
        delete instance.value.attributes
      })
  },
})
export default filter
