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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { customlistType } from '../../src/autogen/types/standard_types/customlist'
import { bundleType } from '../../src/types/bundle_type'
import { LocalFilterOpts } from '../../src/filter'
import { fileType } from '../../src/types/file_cabinet_types'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, PATH, SCRIPT_ID } from '../../src/constants'
import filterCreator from '../../src/filters/bundle_ids'

jest.mock('../../src/autogen/bundle_components/bundle_components', () => ({
  BUNDLE_ID_TO_COMPONENTS: {
    39609: {
      'v4.0.0': new Set(['customlist_ns_ps_process_list']),
    },
  },
}))
describe('bundle_ids filter', () => {
  const filterOpts = {
    config: { fetch: { addBundles: true } },
    isPartial: false,
    elementsSourceIndex: {
      getIndexes: () => {
        throw new Error('should not call getIndexes')
      },
    },
  } as unknown as LocalFilterOpts
  const bundleInstance = new InstanceElement('39609', bundleType().type, { id: '39609', version: 'v4.0.0' })
  const bundleRef = new ReferenceExpression(bundleInstance.elemID)

  describe('onFetch', () => {
    let fileCabinetInstance: InstanceElement
    let recordInstance: InstanceElement
    let falseBundleIdFileCabinetInstance: InstanceElement

    beforeEach(() => {
      recordInstance = new InstanceElement('customlist_ns_ps_process_list', customlistType().type, {
        scriptid: 'customlist_ns_ps_process_list',
      })
      fileCabinetInstance = new InstanceElement('fileInstance', fileType(), {
        [PATH]: 'SuiteBundles/Bundle 39609/SomeInnerFolder/content.html',
      })
      falseBundleIdFileCabinetInstance = new InstanceElement('fileInstance', fileType(), {
        [PATH]: 'SuiteBundles/Bundle 11111/SomeInnerFolder/content.html',
      })
    })

    it('should add bundle field to record instance', async () => {
      await filterCreator(filterOpts).onFetch?.([recordInstance, bundleInstance])
      expect(recordInstance.value.bundle).toEqual(bundleRef)
    })
    it('should add bundle field to fileCabinet instance', async () => {
      await filterCreator(filterOpts).onFetch?.([fileCabinetInstance, bundleInstance])
      expect(fileCabinetInstance.value.bundle).toEqual(bundleRef)
    })

    it("should not add bundle field in case the bundle doesn't exist in the record", async () => {
      const notInRecordBundle = new InstanceElement('0', bundleType().type, { id: '0', installedFrom: 'Production' })
      await filterCreator(filterOpts).onFetch?.([recordInstance, notInRecordBundle])
      expect(fileCabinetInstance.value.bundle).toBeUndefined()
    })

    it("should get serviceId's from existing bundle version if the installed version doesn't exist", async () => {
      const notInRecordVersion = new InstanceElement('39609', bundleType().type, { id: '39609', version: 'v4.1.0' })
      await filterCreator(filterOpts).onFetch?.([fileCabinetInstance, notInRecordVersion])
      expect(fileCabinetInstance.value.bundle).toEqual(bundleRef)
    })

    it('should not add bundle field for bundle that only exists in SuiteBundles', async () => {
      await filterCreator(filterOpts).onFetch?.([falseBundleIdFileCabinetInstance, bundleInstance])
      expect(falseBundleIdFileCabinetInstance.value.bundle).toBeUndefined()
    })
  })

  describe('preDeploy', () => {
    let instanceWithBundle: InstanceElement
    let customRecordType: ObjectType

    beforeEach(() => {
      instanceWithBundle = new InstanceElement('customlist_ns_ps_process_list', customlistType().type, {
        bundle: bundleRef,
      })
      customRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord_my_script_id'),
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          [SCRIPT_ID]: 'customrecord_my_script_id',
          bundle: bundleRef,
        },
      })
    })
    it('should remove bundle field in preDeploy', async () => {
      expect(instanceWithBundle.value.bundle).toEqual(bundleRef)
      expect(customRecordType.annotations.bundle).toEqual(bundleRef)
      await filterCreator(filterOpts).preDeploy?.([
        toChange({ after: instanceWithBundle }),
        toChange({ after: customRecordType }),
      ])
      expect(instanceWithBundle.value.bundle).toBeUndefined()
      expect(customRecordType.annotations.bundle).toBeUndefined()
    })
  })
})
