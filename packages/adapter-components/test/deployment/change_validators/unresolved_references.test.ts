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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, TemplateExpression, toChange, UnresolvedReference } from '@salto-io/adapter-api'
import { createUnresolvedReferencesValidator } from '../../../src/deployment/change_validators/unresolved_references'

describe('unresolved_references', () => {
  const unresolvedElemId = new ElemID('adapter', 'unresolved')
  it('should find unresolved references in instance values', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID('adapter', 'type') }),
      {
        value: new ReferenceExpression(
          unresolvedElemId,
          new UnresolvedReference(unresolvedElemId)
        ),
      }
    )
    const errors = await createUnresolvedReferencesValidator()([toChange({ after: instance })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(instance.elemID)
    expect(errors[0].detailedMessage).toEqual(`Element ${instance.elemID.getFullName()} contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again.`)
  })

  it('should find unresolved references in instance annotation', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID('adapter', 'type') }),
      {},
      [],
      {
        value: new ReferenceExpression(
          unresolvedElemId,
          new UnresolvedReference(unresolvedElemId)
        ),
      },
    )
    const errors = await createUnresolvedReferencesValidator()([toChange({ after: instance })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(instance.elemID)
    expect(errors[0].detailedMessage).toEqual(`Element ${instance.elemID.getFullName()} contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again.`)
  })

  it('should find unresolved references in type annotation', async () => {
    const type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      annotations: {
        value: new ReferenceExpression(
          unresolvedElemId,
          new UnresolvedReference(unresolvedElemId)
        ),
      },
    })

    const errors = await createUnresolvedReferencesValidator()([toChange({ after: type })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(type.elemID)
    expect(errors[0].detailedMessage).toEqual(`Element ${type.elemID.getFullName()} contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again.`)
  })

  it('should find unresolved references in type field annotation', async () => {
    const type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      fields: {
        field: {
          refType: BuiltinTypes.STRING,
          annotations: {
            value: new ReferenceExpression(
              unresolvedElemId,
              new UnresolvedReference(unresolvedElemId)
            ),
          },
        },
      },
    })

    const errors = await createUnresolvedReferencesValidator()([toChange({ after: type })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(type.elemID)
    expect(errors[0].detailedMessage).toEqual(`Element ${type.elemID.getFullName()} contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again.`)
  })

  it('should find unresolved references in templates', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID('adapter', 'type') }),
      {
        value: new TemplateExpression({ parts: ['unresolved', new ReferenceExpression(
          unresolvedElemId,
          new UnresolvedReference(unresolvedElemId)
        ), 'template'] }),
      }
    )
    const errors = await createUnresolvedReferencesValidator()([toChange({ after: instance })])
    expect(errors).toHaveLength(1)
    expect(errors[0].elemID).toEqual(instance.elemID)
    expect(errors[0].detailedMessage).toEqual(`Element ${instance.elemID.getFullName()} contains unresolved references: ${unresolvedElemId.getFullName()}. Add the missing dependencies and try again.`)
  })

  it('should not return errors if does not have unresolved references', async () => {
    const type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      fields: {
        field: {
          refType: BuiltinTypes.STRING,
          annotations: {
            value: new ReferenceExpression(
              new ElemID('adapter', 'someId'),
              'some value'
            ),
          },
        },
      },
    })

    const errors = await createUnresolvedReferencesValidator()([toChange({ after: type })])
    expect(errors).toHaveLength(0)
  })
  it('should not return errors if there are unresolved references in removal change', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID('adapter', 'type') }),
      {
        value: new ReferenceExpression(
          unresolvedElemId,
          new UnresolvedReference(unresolvedElemId)
        ),
      }
    )
    const errors = await createUnresolvedReferencesValidator()([toChange({ before: instance })])
    expect(errors).toHaveLength(0)
  })

  it('should not return unresolved references if matches to shouldIgnore', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID('adapter', 'type') }),
      {
        value: new ReferenceExpression(
          unresolvedElemId,
          new UnresolvedReference(unresolvedElemId)
        ),
      }
    )
    const errors = await createUnresolvedReferencesValidator(id => id.name === 'value')([toChange({ after: instance })])
    expect(errors).toHaveLength(0)
  })
})
