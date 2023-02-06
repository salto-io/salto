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
import { isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { applyFunctionToChangeData, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { isDataObjectType } from '../types'
import { FilterWith } from '../filter'
import { XSI_TYPE } from '../client/constants'

const { awu } = collections.asynciterable

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  name: 'dataInstancesAttributes',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async e => isDataObjectType(await e.getType()))
      .forEach(async e => {
        e.value = await transformValues({
          values: e.value,
          type: await e.getType(),
          strict: false,
          transformFunc: async ({ value }) => {
            if (typeof value === 'object' && 'attributes' in value) {
              _.assign(value, value.attributes)
              delete value.attributes
              delete value[XSI_TYPE]
            }
            return value
          },
        }) ?? e.value
      })
  },

  preDeploy: async changes => {
    await awu(changes)
      .forEach(async change =>
        applyFunctionToChangeData(
          change,
          async element => {
            if (!isInstanceElement(element) || !isDataObjectType(await element.getType())) {
              return element
            }

            element.value = await transformValues({
              values: element.value,
              type: await element.getType(),
              strict: false,
              pathID: element.elemID,
              transformFunc: async ({ value, field, path }) => {
                if (!_.isPlainObject(value) || path?.name === 'attributes') {
                  return value
                }

                const type = path?.isTopLevel() ? await element.getType() : await field?.getType()

                value.attributes = {
                  ...value.attributes,
                  ..._.pickBy(
                    value,
                    (_value, key) => (
                      isObjectType(type)
                      && type.fields[key]?.annotations.isAttribute
                    )
                    // internalId is always an attribute and it is not always will
                    // have the isAttribute annotation, for example, in types that
                    // are not taken from the WSDL, e.g., file cabinet types.
                    || key === 'internalId'
                  ),
                }

                Object.keys(value.attributes).forEach(key => delete value[key])

                return value
              },
            }) ?? element.value

            return element
          }
        ))
  },
})

export default filterCreator
