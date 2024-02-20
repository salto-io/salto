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
import { ObjectType, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { OKTA, PROFILE_MAPPING_TYPE_NAME } from '../../src/constants'
import omitAuthenticatorMappingFilter from '../../src/filters/omit_authenticator_mapping'
import { getFilterParams } from '../utils'

describe('omitAuthenticatorMappingFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  const filter = omitAuthenticatorMappingFilter(getFilterParams()) as FilterType
  const mappingType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_MAPPING_TYPE_NAME) })
  const mappingInstanceA = new InstanceElement('mapp A', mappingType, {
    id: '111',
    source: {
      name: 'oidc_idp',
      type: 'appuser',
    },
    target: {
      name: 'user',
      type: 'user',
    },
  })
  const mappingInstanceB = new InstanceElement('mapp B', mappingType, {
    id: '222',
    source: {
      name: 'Okta_Authenticator',
      type: 'appuser',
    },
    target: {
      name: 'user',
      type: 'user',
    },
  })
  const mappingInstanceC = new InstanceElement('mapp C', mappingType, {
    id: '222',
    source: {
      name: 'user',
      type: 'user',
    },
    target: {
      name: 'Okta_Authenticator',
      type: 'appuser',
    },
  })

  it('should do nothing when there are no Okta_Authenticator ProfileMapping instances', async () => {
    const elements = [mappingType, mappingInstanceA]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(2)
  })
  it('should omit Okta_Authenticator ProfileMapping instances if they exist', async () => {
    const elements = [mappingType, mappingInstanceA, mappingInstanceB, mappingInstanceC]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(2)
    const instances = elements.filter(isInstanceElement)
    expect(instances).toHaveLength(1)
    expect(instances[0].value).toEqual(mappingInstanceA.value)
  })
})
