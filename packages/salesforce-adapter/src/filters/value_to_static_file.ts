/*
*                      Copyright 2020 Salto Labs Ltd.
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
  Element, InstanceElement, Field, isInstanceElement, Value, StaticFile,
} from '@salto-io/adapter-api'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { WEBLINK_METADATA_TYPE } from '../constants'
import { FilterCreator } from '../filter'
import { generateReferenceResolverFinder } from '../transformers/reference_mapping'
import { apiName, metadataType } from '../transformers/transformer'

const log = logger(module)

const LINK_TYPE_FIELD = 'linkType'
const JAVASCRIPT = 'javascript'
const fieldSelectMapping = [
  { src: { field: 'url', parentTypes: [WEBLINK_METADATA_TYPE] } },
]

const hasCodeField = (instance: InstanceElement): boolean => (
  instance.value[LINK_TYPE_FIELD] === JAVASCRIPT
)

const shouldReplace = (field: Field, value: Value, instance: InstanceElement): boolean => {
  const resolverFinder = generateReferenceResolverFinder(fieldSelectMapping)
  return _.isString(value) && hasCodeField(instance) && resolverFinder(field).length > 0
}


const createStaticFile = (instance: InstanceElement, value: string): StaticFile | undefined => {
  if (instance.path === undefined) {
    log.error(`could not extract value of instance ${apiName(instance)} to static file, instance path is undefined`)
    return undefined
  }
  return new StaticFile({
    filepath: `${(instance.path ?? []).join('/')}.js`,
    content: Buffer.from(value),
    encoding: 'utf-8',
  })
}


const extractToStaticFile = (instance: InstanceElement): void => {
  const transformFunc: TransformFunc = ({ value, field }) => {
    if (field === undefined || !shouldReplace(field, value, instance)) {
      return value
    }
    return createStaticFile(instance, value) ?? value
  }

  const values = instance.value
  instance.value = transformValues(
    {
      values,
      type: instance.type,
      transformFunc,
      strict: false,
    }
  ) ?? values
}


/**
 * Extract field value to static-resources for chosen intstances.
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(e => metadataType(e) === WEBLINK_METADATA_TYPE)
      .forEach(inst => extractToStaticFile(inst))
  },
})

export default filter
