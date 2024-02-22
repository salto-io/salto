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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/trim_keys'
import {
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
  METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('trim keys filter', () => {
  const notTrimmed = '\ntrimMe\n'
  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>
  const origInstance = new InstanceElement(
    'test',
    new ObjectType({ elemID: new ElemID(SALESFORCE, 'instanceType') }),
    {
      [notTrimmed]: 'some value',
      leaveMeAlone: 'some other value',
    },
  )

  let instance: InstanceElement
  beforeEach(() => {
    instance = origInstance.clone()
  })

  it('should trim keys', async () => {
    ;(await instance.getType()).annotations[METADATA_TYPE] =
      LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE
    await filter.onFetch([instance])
    expect(instance.value.trimMe).toBeDefined()
    expect(instance.value[notTrimmed]).toBeUndefined()
    expect(instance.value.leaveMeAlone).toBeDefined()
  })

  it('should not trim keys for non listed metadata type', async () => {
    ;(await instance.getType()).annotations[METADATA_TYPE] =
      'NOT LightningComponentBundle'
    await filter.onFetch([instance])
    expect(instance.value[notTrimmed]).toBeDefined()
    expect(instance.value.trimMe).toBeUndefined()
    expect(instance.value.leaveMeAlone).toBeDefined()
  })
})
