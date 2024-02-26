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
import { CORE_ANNOTATIONS, InstanceElement, toChange } from '@salto-io/adapter-api'
import { clientscriptType } from '../../src/autogen/types/standard_types/clientscript'
import { customlistType } from '../../src/autogen/types/standard_types/customlist'
import removeListItemValidator from '../../src/change_validators/remove_list_item'

describe('remove item from customlist change validator', () => {
  const origInstance = new InstanceElement('instance', customlistType().type, {
    customvalues: {
      customvalue: {
        val1: {
          scriptid: 'val_1',
          value: 'value1',
        },
        val2: {
          scriptid: 'val_2',
          value: 'value2',
        },
      },
    },
  })
  let instance: InstanceElement
  beforeEach(() => {
    instance = origInstance.clone()
  })

  describe('When adding new customlist', () => {
    it('should have no change errors when adding a customlist', async () => {
      const changeErrors = await removeListItemValidator([toChange({ after: instance })])
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('When modifying customlist', () => {
    it('should have no change errors when adding a customvalue', async () => {
      const after = instance.clone()
      after.value.customvalues.customvalue.val3 = { scriptid: 'val_3', value: 'Value 3' }
      const changeErrors = await removeListItemValidator([toChange({ before: instance, after })])
      expect(changeErrors).toHaveLength(0)
    })

    it('should have change error when removing a customvalue', async () => {
      const after = instance.clone()
      delete after.value.customvalues.customvalue.val1
      const changeErrors = await removeListItemValidator([toChange({ before: instance, after })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
      expect(changeErrors[0].detailedMessage).toEqual(
        "Netsuite doesn't support the removal of inner element val_1 via API; Salto will ignore this change for this deployment. Please use Netuiste's UI to remove it",
      )
    })

    it('should not have change errors when modifiying a customvalue', async () => {
      const after = instance.clone()
      after.value.customvalues.customvalue.val1.value = 'newVal'
      const changeErrors = await removeListItemValidator([toChange({ before: instance, after })])
      expect(changeErrors).toHaveLength(0)
    })
  })
})

describe('removing inner items from customtypes', () => {
  const origInstance = new InstanceElement(
    'instance',
    clientscriptType().type,
    {
      scriptdeployments: {
        scriptdeployment: {
          customdeploy1: {
            scriptid: 'customdeploy_1',
            status: 'Test',
          },
          customdeploy2: {
            scriptid: 'customdeploy_2',
            status: 'Test',
          },
          customdeploy3: {
            scriptid: 'customdeploy_3',
            status: 'Test',
          },
        },
      },
    },
    undefined,
    {
      [CORE_ANNOTATIONS.CREATED_BY]: 'hello',
    },
  )
  let instance: InstanceElement
  beforeEach(() => {
    instance = origInstance.clone()
  })

  it('should have an Error when removing a customdeploy', async () => {
    const after = instance.clone()
    delete after.value.scriptdeployments.scriptdeployment.customdeploy2

    const changeErrors = await removeListItemValidator([toChange({ before: instance, after })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
    expect(changeErrors[0].detailedMessage).toEqual(
      "Netsuite doesn't support the removal of inner element customdeploy_2 via API; Salto will ignore this change for this deployment. Please use Netuiste's UI to remove it",
    )
  })

  it('should have an Error when removing few customdeploys', async () => {
    const after = instance.clone()
    delete after.value.scriptdeployments.scriptdeployment.customdeploy2
    delete after.value.scriptdeployments.scriptdeployment.customdeploy3

    const changeErrors = await removeListItemValidator([toChange({ before: instance, after })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
    expect(changeErrors[0].detailedMessage).toEqual(
      "Netsuite doesn't support the removal of inner elements customdeploy_2, customdeploy_3 via API; Salto will ignore these changes for this deployment. Please use Netuiste's UI to remove them",
    )
  })

  it('sohuld have an Error when removing scriptid from a customdeploy', async () => {
    const after = instance.clone()
    delete after.value.scriptdeployments.scriptdeployment.customdeploy2.scriptid

    const changeErrors = await removeListItemValidator([toChange({ before: instance, after })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
    expect(changeErrors[0].detailedMessage).toEqual(
      "Netsuite doesn't support the removal of inner element customdeploy_2 via API; Salto will ignore this change for this deployment. Please use Netuiste's UI to remove it",
    )
  })
})
