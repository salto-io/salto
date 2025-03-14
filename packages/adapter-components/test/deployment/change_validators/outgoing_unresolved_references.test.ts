/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  TemplateExpression,
  toChange,
  UnresolvedReference,
} from '@salto-io/adapter-api'
import { createOutgoingUnresolvedReferencesValidator } from '../../../src/deployment/change_validators/outgoing_unresolved_references'

describe('unresolved_references', () => {
  const unresolvedElemId = new ElemID('adapter', 'unresolved')
  it('should find unresolved references in instance values', async () => {
    const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      value: new ReferenceExpression(unresolvedElemId, new UnresolvedReference(unresolvedElemId)),
    })
    const errors = await createOutgoingUnresolvedReferencesValidator()([toChange({ after: instance })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(instance.elemID)
    expect(errors[0].detailedMessage).toEqual(
      `This element contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again. To learn more about fixing this error, go to https://help.salto.io/en/articles/6947056-element-contains-unresolved-references`,
    )
    expect(errors[0].unresolvedElemIds).toEqual([unresolvedElemId])
  })

  it('should find unresolved references in instance annotation', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID('adapter', 'type') }),
      {},
      [],
      {
        value: new ReferenceExpression(unresolvedElemId, new UnresolvedReference(unresolvedElemId)),
      },
    )
    const errors = await createOutgoingUnresolvedReferencesValidator()([toChange({ after: instance })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(instance.elemID)
    expect(errors[0].detailedMessage).toEqual(
      `This element contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again. To learn more about fixing this error, go to https://help.salto.io/en/articles/6947056-element-contains-unresolved-references`,
    )
    expect(errors[0].unresolvedElemIds).toEqual([unresolvedElemId])
    expect(errors[0].type).toEqual('unresolvedReferences')
  })

  it('should find unresolved references in type annotation', async () => {
    const type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      annotations: {
        value: new ReferenceExpression(unresolvedElemId, new UnresolvedReference(unresolvedElemId)),
      },
    })

    const errors = await createOutgoingUnresolvedReferencesValidator()([toChange({ after: type })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(type.elemID)
    expect(errors[0].detailedMessage).toEqual(
      `This element contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again. To learn more about fixing this error, go to https://help.salto.io/en/articles/6947056-element-contains-unresolved-references`,
    )
    expect(errors[0].unresolvedElemIds).toEqual([unresolvedElemId])
    expect(errors[0].type).toEqual('unresolvedReferences')
  })

  it('should find unresolved references in type field annotation', async () => {
    const type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      fields: {
        field: {
          refType: BuiltinTypes.STRING,
          annotations: {
            value: new ReferenceExpression(unresolvedElemId, new UnresolvedReference(unresolvedElemId)),
          },
        },
      },
    })

    const errors = await createOutgoingUnresolvedReferencesValidator()([toChange({ after: type })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(type.elemID)
    expect(errors[0].detailedMessage).toEqual(
      `This element contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again. To learn more about fixing this error, go to https://help.salto.io/en/articles/6947056-element-contains-unresolved-references`,
    )
    expect(errors[0].unresolvedElemIds).toEqual([unresolvedElemId])
    expect(errors[0].type).toEqual('unresolvedReferences')
  })

  it('should filter out unresolved references to nested paths if their parent path is also unresolved', async () => {
    const typeElemID = new ElemID('adapter', 'typeA')
    const fieldElemID = typeElemID.createNestedID('field', 'A')

    const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'layout') }), {
      refToType: new ReferenceExpression(typeElemID, new UnresolvedReference(typeElemID)),
      refToField: new ReferenceExpression(fieldElemID, new UnresolvedReference(fieldElemID)),
    })
    const errors = await createOutgoingUnresolvedReferencesValidator()([toChange({ after: instance })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(instance.elemID)
    expect(errors[0].detailedMessage).toEqual(
      `This element contains unresolved references: ${typeElemID.getFullName()}. Add the missing dependencies and try again. To learn more about fixing this error, go to https://help.salto.io/en/articles/6947056-element-contains-unresolved-references`,
    )
    expect(errors[0].unresolvedElemIds).toEqual([typeElemID])
  })

  it('should find unresolved references in templates', async () => {
    const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      value: new TemplateExpression({
        parts: [
          'unresolved',
          new ReferenceExpression(unresolvedElemId, new UnresolvedReference(unresolvedElemId)),
          'template',
        ],
      }),
    })
    const errors = await createOutgoingUnresolvedReferencesValidator()([toChange({ after: instance })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(instance.elemID)
    expect(errors[0].detailedMessage).toEqual(
      `This element contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again. To learn more about fixing this error, go to https://help.salto.io/en/articles/6947056-element-contains-unresolved-references`,
    )
    expect(errors[0].unresolvedElemIds).toEqual([unresolvedElemId])
    expect(errors[0].type).toEqual('unresolvedReferences')
  })

  it('should not return errors if does not have unresolved references', async () => {
    const type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      fields: {
        field: {
          refType: BuiltinTypes.STRING,
          annotations: {
            value: new ReferenceExpression(new ElemID('adapter', 'someId'), 'some value'),
          },
        },
      },
    })

    const errors = await createOutgoingUnresolvedReferencesValidator()([toChange({ after: type })])
    expect(errors).toHaveLength(0)
  })
  it('should not return errors if there are unresolved references in removal change', async () => {
    const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      value: new ReferenceExpression(unresolvedElemId, new UnresolvedReference(unresolvedElemId)),
    })
    const errors = await createOutgoingUnresolvedReferencesValidator()([toChange({ before: instance })])
    expect(errors).toHaveLength(0)
  })

  it('should not return unresolved references if matches to shouldIgnore', async () => {
    const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      value: new ReferenceExpression(unresolvedElemId, new UnresolvedReference(unresolvedElemId)),
    })
    const errors = await createOutgoingUnresolvedReferencesValidator(id => id.name === 'value')([
      toChange({ after: instance }),
    ])
    expect(errors).toHaveLength(0)
  })
})
