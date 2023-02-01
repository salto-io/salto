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
import {
  Element, InstanceElement, Field, isInstanceElement, Value, StaticFile,
} from '@salto-io/adapter-api'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { WEBLINK_METADATA_TYPE } from '../constants'
import { LocalFilterCreator } from '../filter'
import { generateReferenceResolverFinder } from '../transformers/reference_mapping'
import { apiName, metadataType } from '../transformers/transformer'

const { awu } = collections.asynciterable

const log = logger(module)

const LINK_TYPE_FIELD = 'linkType'
const JAVASCRIPT = 'javascript'
const fieldSelectMapping = [
  { src: { field: 'url', parentTypes: [WEBLINK_METADATA_TYPE] } },
]

const hasCodeField = (instance: InstanceElement): boolean => (
  instance.value[LINK_TYPE_FIELD] === JAVASCRIPT
)

const shouldReplace = async (
  field: Field,
  value: Value,
  instance: InstanceElement
): Promise<boolean> => {
  const resolverFinder = generateReferenceResolverFinder(fieldSelectMapping)
  return (_.isString(value)
    && hasCodeField(instance)
    && (await resolverFinder(field, instance)).length > 0)
}


const createStaticFile = async (
  instance: InstanceElement,
  value: string
): Promise<StaticFile | undefined> => {
  if (instance.path === undefined) {
    log.error(`could not extract value of instance ${await apiName(instance)} to static file, instance path is undefined`)
    return undefined
  }
  return new StaticFile({
    filepath: `${instance.path.join('/')}.js`,
    content: Buffer.from(value),
    encoding: 'utf-8',
  })
}


const extractToStaticFile = async (instance: InstanceElement): Promise<void> => {
  const transformFunc: TransformFunc = async ({ value, field }) => {
    if (field === undefined || !(await shouldReplace(field, value, instance))) {
      return value
    }
    return (await createStaticFile(instance, value)) ?? value
  }

  const values = instance.value
  instance.value = await transformValues(
    {
      values,
      type: await instance.getType(),
      transformFunc,
      strict: false,
      allowEmpty: true,
    }
  ) ?? values
}


/**
 * Extract field value to static-resources for chosen intstances.
 */
const filter: LocalFilterCreator = () => ({
  name: 'valueToStaticFileFilter',
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async e => await metadataType(e) === WEBLINK_METADATA_TYPE)
      .forEach(inst => extractToStaticFile(inst))
  },
})

export default filter
