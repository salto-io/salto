/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  ReadOnlyElementsSource,
  InstanceElement,
  ReferenceExpression,
  toChange,
  Change,
  ChangeDataType,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'
import { fieldContextOptionsValidator } from '../../../src/change_validators/field_contexts/field_context_options'
import { JIRA } from '../../../src/constants'

describe('Field context options', () => {
  let contextType: ObjectType
  let elementsSource: ReadOnlyElementsSource
  let elements: InstanceElement[]
  let contextInstance: InstanceElement
  let changes: ReadonlyArray<Change<ChangeDataType>>
  let optionType: ObjectType
  let optionInstance1: InstanceElement
  let optionInstance2: InstanceElement

  beforeEach(() => {
    jest.clearAllMocks()
    contextType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME) })
    optionType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME) })

    contextInstance = new InstanceElement('context', contextType, {})

    optionInstance1 = new InstanceElement('option1', optionType, {}, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance, contextInstance)],
    })
    optionInstance2 = new InstanceElement('option2', optionType, {}, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance, contextInstance)],
    })
    contextInstance.value.options = [
      new ReferenceExpression(optionInstance1.elemID, optionInstance1, optionInstance1),
      new ReferenceExpression(optionInstance2.elemID, optionInstance2, optionInstance2),
    ]

    elements = [contextInstance, optionInstance1, optionInstance2]
    elementsSource = buildElementsSourceFromElements(elements)
  })
  it('should not return errors when changing only context', async () => {
    changes = [toChange({ after: contextInstance })]
    const errors = await fieldContextOptionsValidator(changes, elementsSource)
    expect(errors).toHaveLength(0)
  })
  it("should not return errors when changing option and it's context reference it", async () => {
    changes = [toChange({ after: optionInstance1 })]
    const errors = await fieldContextOptionsValidator(changes, elementsSource)
    expect(errors).toHaveLength(0)
  })
  it('should not return errors when removing an option', async () => {
    changes = [toChange({ before: optionInstance1 })]
    const errors = await fieldContextOptionsValidator(changes, elementsSource)
    expect(errors).toHaveLength(0)
  })
  // it('should return an error when adding an option without referencing it in the context', async () => {
  //   contextInstance.value.options.pop()
  //   changes = [toChange({ after: optionInstance2 })]
  //   const errors = await fieldContextOptionsValidator(changes, elementsSource)
  //   expect(errors).toEqual([
  //     {
  //       elemID: optionInstance2.elemID,
  //       severity: 'Error',
  //       message: "This option is not being referenced by it's parent context",
  //       detailedMessage:
  //         "The parent context jira.CustomFieldContext.instance.context should reference all it's options",
  //     },
  //   ])
  // })
  // it('should return an error when changing an option and removing it from the context', async () => {
  //   const afterContext = contextInstance.clone()
  //   afterContext.value.options.pop()
  //   changes = [toChange({ after: optionInstance2 }), toChange({ before: contextInstance, after: afterContext })]
  //   elementsSource = buildElementsSourceFromElements([afterContext, optionInstance2, optionInstance1])
  //   const errors = await fieldContextOptionsValidator(changes, elementsSource)
  //   expect(errors).toEqual([
  //     {
  //       elemID: optionInstance2.elemID,
  //       severity: 'Error',
  //       message: "This option is not being referenced by it's parent context",
  //       detailedMessage:
  //         "The parent context jira.CustomFieldContext.instance.context should reference all it's options",
  //     },
  //   ])
  // })
  // it('should return an error when the parent context have no options field', async () => {
  //   delete contextInstance.value.options
  //   changes = [toChange({ after: optionInstance1 })]
  //   const errors = await fieldContextOptionsValidator(changes, elementsSource)
  //   expect(errors).toEqual([
  //     {
  //       elemID: optionInstance1.elemID,
  //       severity: 'Error',
  //       message: "This option is not being referenced by it's parent context",
  //       detailedMessage:
  //         "The parent context jira.CustomFieldContext.instance.context should reference all it's options",
  //     },
  //   ])
  // })
  it('should not return errors when the elementsSource is undefined', async () => {
    delete contextInstance.value.options
    changes = [toChange({ after: optionInstance1 })]
    const errors = await fieldContextOptionsValidator(changes)
    expect(errors).toHaveLength(0)
  })
})
