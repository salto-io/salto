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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  getChangeData,
  toChange,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils/src/element_source'
import filterCreator from '../../src/filters/remove_missing_references_from_forms'
import { LocalFilterOpts } from '../../src/filter'
import { NETSUITE, SCRIPT_ID, TRANSACTION_FORM } from '../../src/constants'
import { transactionFormType } from '../../src/autogen/types/standard_types/transactionForm'

describe('remove_missing_references_from_forms filter', () => {
  let form: InstanceElement
  const instanceToReference1 = new InstanceElement(
    'instance1',
    new ObjectType({
      elemID: new ElemID(NETSUITE, 'instance1'),
    }),
    {
      [SCRIPT_ID]: 'instance1',
    },
  )
  const instanceToReference2 = new InstanceElement(
    'instance2',
    new ObjectType({
      elemID: new ElemID(NETSUITE, 'instance2'),
    }),
    {
      [SCRIPT_ID]: 'instance2',
    },
  )
  const formInstance = new InstanceElement(
    'form',
    transactionFormType().type,
    {
      [SCRIPT_ID]: 'form',
      field1: {
        id: new ReferenceExpression(
          instanceToReference1.elemID.createNestedID(SCRIPT_ID),
          instanceToReference1.value.scriptid,
          instanceToReference1,
        ),
      },
      unresolved1: {
        id: '[scriptid=unresolved]',
      },
      parentField: {
        stringField1: {
          id: 'some string id',
          index: 0,
        },
        unresolved2: {
          id: '[scriptid=unresolved]',
          index: 1,
        },
        unresolved3: {
          id: '[scriptid=unresolved]',
          index: 2,
        },
        generatedDependency: {
          id: '[type=transactionbodycustomfield, scriptid=instance2]',
          index: 3,
        },
        stringField2: {
          id: 'some string id',
          index: 4,
        },
      },
    },
    [NETSUITE, TRANSACTION_FORM, 'form'],
    {
      [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
        {
          reference: new ReferenceExpression(
            instanceToReference2.elemID.createNestedID(SCRIPT_ID),
            instanceToReference2.value.scriptid,
            instanceToReference2,
          ),
        },
        {
          invalid: 'irrelevent generated dependency',
        },
      ],
    },
  )
  beforeEach(() => {
    form = formInstance.clone()
  })
  it('should remove unresolved netsuite references when addition', async () => {
    delete form.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]

    const changes = [toChange({ after: form })]
    const elementsSource = buildElementsSourceFromElements([instanceToReference1])
    const originalNumOfChanges = changes.length
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)

    expect(changes.length).toEqual(originalNumOfChanges)
    const newForm = getChangeData(changes[0])
    expect(newForm.value.unresolved1).toBeUndefined()
    expect(newForm.value.parentField.unresolved2).toBeUndefined()
    expect(newForm.value.parentField.unresolved3).toBeUndefined()
    expect(newForm.value.parentField.generatedDependency).toBeUndefined()
    expect(newForm.value.parentField.stringField1.index).toEqual(0)
    expect(newForm.value.parentField.stringField2.index).toEqual(1)
  })
  it('should do nothing when there are no unresolved netsuite references', async () => {
    delete form.value.unresolved1
    delete form.value.parentField.unresolved2
    delete form.value.parentField.unresolved3
    delete form.value.parentField.generatedDependency

    const changes = [toChange({ after: form.clone() })]
    const elementsSource = buildElementsSourceFromElements([])
    const originalNumOfChanges = changes.length
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)

    expect(changes.length).toEqual(originalNumOfChanges)
    expect(getChangeData(changes[0])).toEqual(form)
  })
  it('should keep references that related to generated dependencies', async () => {
    const changes = [toChange({ after: form.clone() })]
    const elementsSource = buildElementsSourceFromElements([instanceToReference1, instanceToReference2])
    const originalNumOfChanges = changes.length
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)

    expect(changes.length).toEqual(originalNumOfChanges)
    const newForm = getChangeData(changes[0])
    expect(newForm.value.unresolved1).toBeUndefined()
    expect(newForm.value.parentField.unresolved2).toBeUndefined()
    expect(newForm.value.parentField.unresolved3).toBeUndefined()
    expect(newForm.value.parentField.stringField1.index).toEqual(0)
    expect(newForm.value.parentField.generatedDependency.index).toEqual(1)
    expect(newForm.value.parentField.stringField2.index).toEqual(2)
  })
  it('should remove added unresolved netsuite reference and keep existing unresolved netsuite reference', async () => {
    const formBefore = form.clone()
    delete formBefore.value.parentField.unresolved3

    const changes = [toChange({ before: formBefore, after: form })]
    const elementsSource = buildElementsSourceFromElements([instanceToReference1])
    const originalNumOfChanges = changes.length
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)

    expect(changes.length).toEqual(originalNumOfChanges)
    const newForm = getChangeData(changes[0])
    expect(newForm.value.parentField.unresolved3).toBeUndefined()
    expect(newForm.value.unresolved1).toBeDefined()
    expect(newForm.value.parentField.unresolved2).toBeDefined()
    expect(newForm.value.parentField.stringField1.index).toEqual(0)
    expect(newForm.value.parentField.unresolved2.index).toEqual(1)
    expect(newForm.value.parentField.generatedDependency.index).toEqual(2)
    expect(newForm.value.parentField.stringField2.index).toEqual(3)
  })
})
