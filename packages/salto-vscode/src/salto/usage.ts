import _ from 'lodash'
import { dumpElemID } from 'salto'
import { Element, isObjectType, isInstanceElement } from 'adapter-api'
import { getLocations, SaltoElemLocation } from './location'
import { EditorWorkspace } from './workspace'

// TODO - Note that this will have no great performances until we will get the
// reverse SM from salto's core. This is acceptable as this is not called so often
const getUsages = (
  workspace: EditorWorkspace,
  element: Element,
  fullName: string
): SaltoElemLocation[] => {
  if (isObjectType(element)) {
    return _(element.fields)
      .values()
      .filter(f => fullName === dumpElemID(f.type))
      .map(f => getLocations(workspace, f.elemID.getFullName()))
      .flatten()
      .value()
  }
  if (isInstanceElement(element)) {
    const typeDumpName = dumpElemID(element.type)
    return (typeDumpName === fullName) ? getLocations(workspace, element.elemID.getFullName())
      : []
  }
  return []
}

export const provideWorkspaceReferences = (
  workspace: EditorWorkspace,
  token: string
): SaltoElemLocation[] => (
  _.reduce(
    workspace.elements,
    (acc, e) => ([...acc, ...getUsages(workspace, e, token)]),
    [] as SaltoElemLocation[]
  )
)
