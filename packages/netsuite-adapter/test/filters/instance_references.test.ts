/*
*                      Copyright 2021 Salto Labs Ltd.
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
import {
  ElemID, InstanceElement, ObjectType, ReferenceExpression,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/instance_references'
import { customTypes, fileCabinetTypes } from '../../src/types'
import { FILE, PATH, SCRIPT_ID, WORKFLOW } from '../../src/constants'


describe('instance_references filter', () => {
  describe('replace values', async () => {
    let fileInstance: InstanceElement
    let instanceInElementsSource: InstanceElement
    let workflowInstance: InstanceElement
    let instanceWithRefs: InstanceElement
    beforeEach(async () => {
      fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
        [PATH]: '/Templates/file.name',
      })

      instanceInElementsSource = new InstanceElement('instanceInElementsSource', fileCabinetTypes[FILE], {
        [PATH]: '/Templates/instanceInElementsSource',
      })

      workflowInstance = new InstanceElement('instanceName', customTypes[WORKFLOW], {
        [SCRIPT_ID]: 'top_level',
        workflowstates: {
          workflowstate: [
            {
              [SCRIPT_ID]: 'one_nesting',
              workflowactions: [
                {
                  setfieldvalueaction: [
                    {
                      [SCRIPT_ID]: 'two_nesting',
                    },
                    {
                      [SCRIPT_ID]: 'two_nesting_with_inner_ref',
                      field: '[scriptid=top_level.one_nesting.two_nesting]',
                    },
                  ],
                },
              ],
            },
          ],
        },
      })

      instanceWithRefs = new InstanceElement(
        'instanceName',
        new ObjectType({ elemID: new ElemID('') }),
        {
          refToFilePath: '[/Templates/file.name]',
          refToScriptId: '[scriptid=top_level]',
          refToOneLevelNestedScriptId: '[scriptid=top_level.one_nesting]',
          refToTwoLevelNestedScriptId: '[scriptid=top_level.one_nesting.two_nesting]',
          refToNonExistingScriptId: '[scriptid=non_existing_script_id]',
          refToNonExistingPath: '[/Templates/non.existing]',
          refToInstanceInElementSourcePath: '[/Templates/instanceInElementsSource]',
        },
      )
    })

    it('should replace path references', async () => {
      await filterCreator().onFetch({
        elements: [fileInstance, workflowInstance, instanceWithRefs],
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      })

      expect(instanceWithRefs.value.refToFilePath)
        .toEqual(new ReferenceExpression(fileInstance.elemID.createNestedID(PATH)))
    })

    it('should replace scriptid references', async () => {
      await filterCreator().onFetch({
        elements: [fileInstance, workflowInstance, instanceWithRefs],
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      })

      expect(instanceWithRefs.value.refToScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID(SCRIPT_ID)))
    })

    it('should replace scriptid with 1 nesting level references', async () => {
      await filterCreator().onFetch({
        elements: [fileInstance, workflowInstance, instanceWithRefs],
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      })

      expect(instanceWithRefs.value.refToOneLevelNestedScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', SCRIPT_ID)))
    })

    it('should replace scriptid with 2 nesting level references', async () => {
      await filterCreator().onFetch({
        elements: [fileInstance, workflowInstance, instanceWithRefs],
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      })

      expect(instanceWithRefs.value.refToTwoLevelNestedScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', 'workflowactions', '0', 'setfieldvalueaction', '0', SCRIPT_ID)))
    })

    it('should replace inner scriptid references', async () => {
      await filterCreator().onFetch({
        elements: [fileInstance, workflowInstance, instanceWithRefs],
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      })

      expect(workflowInstance.value.workflowstates.workflowstate[0].workflowactions[0]
        .setfieldvalueaction[1].field)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', 'workflowactions', '0', 'setfieldvalueaction', '0', SCRIPT_ID)))
    })

    it('should not replace scriptid references for unresolved ref', async () => {
      await filterCreator().onFetch({
        elements: [fileInstance, workflowInstance, instanceWithRefs],
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      })

      expect(instanceWithRefs.value.refToNonExistingScriptId)
        .toEqual('[scriptid=non_existing_script_id]')
    })

    it('should not replace path references for unresolved ref', async () => {
      await filterCreator().onFetch({
        elements: [fileInstance, workflowInstance, instanceWithRefs],
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      })

      expect(instanceWithRefs.value.refToNonExistingPath)
        .toEqual('[/Templates/non.existing]')
    })

    it('should use elements source for creating the references with fetch is partial', async () => {
      await filterCreator().onFetch({
        elements: [fileInstance, workflowInstance, instanceWithRefs],
        elementsSource: buildElementsSourceFromElements([instanceInElementsSource]),
        isPartial: true,
      })

      expect(instanceWithRefs.value.refToInstanceInElementSourcePath)
        .toEqual(new ReferenceExpression(instanceInElementsSource.elemID.createNestedID(PATH)))
    })

    it('should not use elements source for creating the references when fetch is not partial', async () => {
      await filterCreator().onFetch({
        elements: [fileInstance, workflowInstance, instanceWithRefs],
        elementsSource: buildElementsSourceFromElements([instanceInElementsSource]),
        isPartial: false,
      })

      expect(instanceWithRefs.value.refToInstanceInElementSourcePath)
        .toEqual('[/Templates/instanceInElementsSource]')
    })
  })
})
