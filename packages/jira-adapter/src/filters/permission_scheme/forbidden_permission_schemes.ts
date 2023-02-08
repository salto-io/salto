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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { PERMISSION_SCHEME_TYPE_NAME } from '../../constants'

export const isPermissionScheme = (element: Element): boolean =>
  element.elemID.typeName === PERMISSION_SCHEME_TYPE_NAME

const UnsupportedPermissionSchemes = [
  'VIEW_PROJECTS',
  'VIEW_ISSUES',
]
/**
 * Remove unsupported permissions from permission schemes
 */
const filter: FilterCreator = () => ({
  name: 'forbiddenPermissionSchemeFilter',
  onFetch: async (elements: Element[]) => {
    elements.filter(isPermissionScheme).filter(isInstanceElement).forEach(element => {
      _.remove(element.value.permissions,
        (p: { permission: string }) => UnsupportedPermissionSchemes.includes(p.permission))
    })
  },
})

export default filter
