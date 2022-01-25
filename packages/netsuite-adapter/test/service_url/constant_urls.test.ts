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
import { CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import { role } from '../../src/autogen/types/custom_types/role'
import NetsuiteClient from '../../src/client/client'
import setServiceUrl from '../../src/service_url/constant_urls'
import { NETSUITE } from '../../src/constants'


describe('setConstantUrls', () => {
  const client = {
    url: 'https://tstdrv2259448.app.netsuite.com',
  } as unknown as NetsuiteClient

  let elements: ObjectType[]

  beforeEach(() => {
    elements = [
      role,
    ]
  })

  it('should set the right url', async () => {
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://tstdrv2259448.app.netsuite.com/app/setup/rolelist.nl')
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
