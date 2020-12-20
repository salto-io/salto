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
  Element, isObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import * as constants from '../constants'
import { FilterCreator } from '../filter'

const removeMemoryOnlyAnnotations = (elements: Element[]): void => {
  elements
    .filter(isObjectType)
    .flatMap(e => ([e, ...Object.values(e.fields)]))
    .filter(e => (Object.keys(e.annotations).concat(Object.keys(e.annotationRefTypes))).some(
      t => constants.MEMORY_ONLY_ANNOTATIONS.includes(t)
    ))
    .forEach(e => {
      e.annotations = _.omit(e.annotations, constants.MEMORY_ONLY_ANNOTATIONS)
      e.annotationRefTypes = _.omit(e.annotationRefTypes, constants.MEMORY_ONLY_ANNOTATIONS)
    })
}

/**
 * Remove annotations that should not be persisted.
 *
 * Note: This is a temporary filter, it should be replaced by state-only hidden annotations
 * once SALTO-910 is supported.
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    removeMemoryOnlyAnnotations(elements)
  },
})

export default filter
