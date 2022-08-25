/*
*                      Copyright 2022 Salto Labs Ltd.
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

import _ from 'lodash'
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { naclCase } from '@salto-io/adapter-utils'

const MISSING_REF_PREFIX = 'missing_'
export const ZendeskMissingReferenceStrategyLookup: Record<
referenceUtils.MissingReferenceStrategyName, referenceUtils.MissingReferenceStrategy
> = {
  typeAndValue: {
    create: ({ value, adapter, typeName }) => {
      if (!_.isString(typeName) || !value) {
        return undefined
      }
      return new InstanceElement(
        naclCase(`${MISSING_REF_PREFIX}${value}`),
        new ObjectType({ elemID: new ElemID(adapter, typeName) }),
        {},
        undefined,
        { [referenceUtils.MISSING_ANNOTATION]: true },
      )
    },
  },
}
