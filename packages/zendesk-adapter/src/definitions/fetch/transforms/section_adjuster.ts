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
import { Values } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'
import { transform as transformGuideItem } from './guide_adjuster'
import { CATEGORY_TYPE_NAME, SECTION_TYPE_NAME } from '../../../constants'

// this transformer adds direct_parent_id and direct_parent_type to sections, this is used later in filters
export const transform: definitions.AdjustFunction = async ({ value, context, typeName }) => {
  const valueWithGuide = await transformGuideItem({ value, context, typeName })
  const retVal: Values = { ...valueWithGuide.value }
  // need to add direct parent to a section as it is possible to have a section inside
  // a section and therefore the elemeID will change accordingly.
  if (typeName === SECTION_TYPE_NAME) {
    if (_.get(value, 'parent_section_id') === undefined || _.get(value, 'parent_section_id') === null) {
      retVal.direct_parent_id = _.get(value, 'category_id')
      retVal.direct_parent_type = CATEGORY_TYPE_NAME
    } else {
      retVal.direct_parent_id = _.get(value, 'parent_section_id')
      retVal.direct_parent_type = SECTION_TYPE_NAME
    }
  }

  return {
    value: {
      ...retVal,
    },
  }
}
