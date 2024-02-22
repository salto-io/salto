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

import { Workspace } from '@salto-io/workspace'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { EditorWorkspace } from '../src/workspace'
import { PositionContext } from '../src/context'
import { getServiceUrl } from '../src/service_url'
import { mockWorkspace } from './workspace'

describe('getServiceUrl', () => {
  let ctx: PositionContext
  let editorWorkspace: EditorWorkspace
  let workspace: Workspace

  beforeEach(async () => {
    ctx = {
      range: {
        start: { col: 1, line: 1 },
        end: { col: 2, line: 2 },
      },
      type: 'instance',
    }

    workspace = await mockWorkspace()
    editorWorkspace = new EditorWorkspace('baseDir', workspace)
  })

  it('when ref is undefined should return undefined', async () => {
    expect(await getServiceUrl(editorWorkspace, ctx)).toBeUndefined()
  })

  it('when element does not have service url annotation should return undefined', async () => {
    const elemID = new ElemID('salesforce', 'Account')
    ctx.ref = {
      element: new ObjectType({ elemID }),
      path: [],
      isList: false,
      id: elemID,
    }

    workspace.getValue = mockFunction<Workspace['getValue']>().mockResolvedValue(
      new ObjectType({ elemID: new ElemID('salesforce', 'Account') }),
    )

    expect(await getServiceUrl(editorWorkspace, ctx)).toBeUndefined()
    expect(workspace.getValue).toHaveBeenCalledWith(ctx.ref.element.elemID)
  })

  it('when getValue return non-element value should return undefined', async () => {
    const elemID = new ElemID('salesforce', 'Account')
    ctx.ref = {
      element: new ObjectType({ elemID }),
      path: [],
      isList: false,
      id: elemID,
    }

    workspace.getValue = mockFunction<Workspace['getValue']>().mockResolvedValue('aaa')

    expect(await getServiceUrl(editorWorkspace, ctx)).toBeUndefined()
    expect(workspace.getValue).toHaveBeenCalledWith(ctx.ref.element.elemID)
  })

  it('should return the url of the element in the context', async () => {
    const elemID = new ElemID('salesforce', 'Account')
    ctx.ref = {
      element: new ObjectType({ elemID }),
      path: [],
      isList: false,
      id: elemID,
    }

    workspace.getValue = mockFunction<Workspace['getValue']>().mockResolvedValue(
      new ObjectType({
        elemID: new ElemID('salesforce', 'Account'),
        annotations: { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://someurl.com' },
      }),
    )

    expect(await getServiceUrl(editorWorkspace, ctx)).toEqual(new URL('https://someurl.com'))
    expect(workspace.getValue).toHaveBeenCalledWith(ctx.ref.element.elemID)
  })

  it('when parent has annoation and child does not should return the url of the parent', async () => {
    const elemID = new ElemID('salesforce', 'Account')
    const type = new ObjectType({
      elemID,
      fields: {
        fieldName: {
          refType: BuiltinTypes.NUMBER,
        },
      },
    })

    ctx.ref = {
      element: type.fields.fieldName,
      path: [],
      isList: false,
      id: type.fields.fieldName.elemID,
    }

    const typeWithAnnotations = type.clone()
    typeWithAnnotations.annotations = { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://someurl.com' }

    workspace.getValue = mockFunction<Workspace['getValue']>().mockImplementation(async id => {
      if (typeWithAnnotations.elemID.isEqual(id)) {
        return typeWithAnnotations
      }
      if (typeWithAnnotations.fields.fieldName.elemID.isEqual(id)) {
        return typeWithAnnotations.fields.fieldName
      }
      return undefined
    })

    expect(await getServiceUrl(editorWorkspace, ctx)).toEqual(new URL('https://someurl.com'))
    expect(workspace.getValue).toHaveBeenCalledWith(type.elemID)
  })

  it('when parent has annoation and child has annotation return the url of the child', async () => {
    const elemID = new ElemID('salesforce', 'Account')
    const type = new ObjectType({
      elemID,
      fields: {
        fieldName: {
          refType: BuiltinTypes.NUMBER,
        },
      },
    })

    ctx.ref = {
      element: type.fields.fieldName,
      path: [],
      isList: false,
      id: type.fields.fieldName.elemID,
    }

    const typeWithAnnotations = type.clone()
    typeWithAnnotations.annotations = { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://someurl.com' }
    typeWithAnnotations.fields.fieldName = typeWithAnnotations.fields.fieldName.clone()
    typeWithAnnotations.fields.fieldName.annotations = { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://someurl2.com' }

    workspace.getValue = mockFunction<Workspace['getValue']>().mockImplementation(async id => {
      if (typeWithAnnotations.elemID.isEqual(id)) {
        return typeWithAnnotations
      }
      if (typeWithAnnotations.fields.fieldName.elemID.isEqual(id)) {
        return typeWithAnnotations.fields.fieldName
      }
      return undefined
    })

    expect(await getServiceUrl(editorWorkspace, ctx)).toEqual(new URL('https://someurl2.com'))
    expect(workspace.getValue).toHaveBeenCalledWith(type.fields.fieldName.elemID)
  })
})
