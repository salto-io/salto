
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
import { InstanceElement } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { ACTIVATE_RSS, INSTANCE_FULL_NAME_FIELD } from '../../src/constants'
import filterCreator from '../../src/filters/add_default_activate_rss'

describe('addDefaultActivateRSSFilter', () => {
  const INSTANCE_NAME = 'testInstalledPackageInstance'
  const filter = filterCreator()

  let installedPackageInstance: InstanceElement

  beforeEach(async () => {
    installedPackageInstance = new InstanceElement(
      INSTANCE_NAME,
      mockTypes.InstalledPackage,
      {
        [INSTANCE_FULL_NAME_FIELD]: INSTANCE_NAME,
        [ACTIVATE_RSS]: { 'attr_xsi:nil': 'true' },
      }
    )
    await filter.onFetch([installedPackageInstance])
  })

  it('should set activateRSS to false', () => {
    expect(installedPackageInstance.value[ACTIVATE_RSS]).toBeFalse()
  })
})
