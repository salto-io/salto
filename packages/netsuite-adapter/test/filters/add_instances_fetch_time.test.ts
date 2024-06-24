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
import filterCreator from '../../src/filters/add_instances_fetch_time'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'
import { fileType } from '../../src/types/file_cabinet_types'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, PATH, SCRIPT_ID } from '../../src/constants'
import { SERVER_TIME_TYPE_NAME } from '../../src/server_time'
import { LocalFilterOpts } from '../../src/filter'

describe('add instances fetch time filter', () => {
  const fetchTime = new Date('01/01/2024')
  const serverTimeType = new ObjectType({ elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME) })

  let serverTimeInstance: InstanceElement
  beforeEach(() => {
    serverTimeInstance = new InstanceElement(ElemID.CONFIG_NAME, serverTimeType)
  })
  it('should add standard instance fetch time', async () => {
    const instance = new InstanceElement('cseg1', customsegmentType().type, { [SCRIPT_ID]: 'cseg1' })
    await filterCreator({ fetchTime } as LocalFilterOpts).onFetch?.([serverTimeInstance, instance])
    expect(serverTimeInstance.value.instancesFetchTime).toEqual({
      cseg1: fetchTime.toJSON(),
    })
  })
  it('should add file instance fetch time', async () => {
    const instance = new InstanceElement('someFile', fileType(), { [PATH]: '/SuiteScript/someFile' })
    await filterCreator({ fetchTime } as LocalFilterOpts).onFetch?.([serverTimeInstance, instance])
    expect(serverTimeInstance.value.instancesFetchTime).toEqual({
      '/SuiteScript/someFile': fetchTime.toJSON(),
    })
  })
  it('should add custom record type fetch time', async () => {
    const customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotations: {
        [SCRIPT_ID]: 'customrecord1',
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    await filterCreator({ fetchTime } as LocalFilterOpts).onFetch?.([serverTimeInstance, customRecordType])
    expect(serverTimeInstance.value.instancesFetchTime).toEqual({
      customrecord1: fetchTime.toJSON(),
    })
  })
  it('should not add data instance fetch time', async () => {
    const dataType = new ObjectType({ elemID: new ElemID(NETSUITE, 'account') })
    const instance = new InstanceElement('account1', dataType, { [SCRIPT_ID]: 'account1' })
    await filterCreator({ fetchTime } as LocalFilterOpts).onFetch?.([serverTimeInstance, instance])
    expect(serverTimeInstance.value.instancesFetchTime).toEqual({})
  })
  it('should not add without fetch time', async () => {
    const instance = new InstanceElement('cseg1', customsegmentType().type, { [SCRIPT_ID]: 'cseg1' })
    await filterCreator({} as LocalFilterOpts).onFetch?.([serverTimeInstance, instance])
    expect(serverTimeInstance.value.instancesFetchTime).toBeUndefined()
  })
  it('should not add without server time instance', async () => {
    const instance = new InstanceElement('cseg1', customsegmentType().type, { [SCRIPT_ID]: 'cseg1' })
    await filterCreator({ fetchTime } as LocalFilterOpts).onFetch?.([instance])
    expect(serverTimeInstance.value.instancesFetchTime).toBeUndefined()
  })
  it('should not add instance if service id is missing', async () => {
    const instance = new InstanceElement('cseg1', customsegmentType().type, { name: 'cseg1' })
    await filterCreator({ fetchTime } as LocalFilterOpts).onFetch?.([serverTimeInstance, instance])
    expect(serverTimeInstance.value.instancesFetchTime).toEqual({})
  })
})
