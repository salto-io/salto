import _ from 'lodash'
import { dumpElemID } from 'salto'
import { Element, isObjectType, isInstanceElement } from 'adapter-api'
import { getLocations, SaltoElemLocation } from './location'
import { EditorWorkspace } from './workspace'

// TODO - Note that this will have no great performances until we will get the
// reverse SM from salto's core. This is acceptable as this is not called so often
const getUsages = async (
  workspace: EditorWorkspace,
  element: Element,
  fullName: string
): Promise<SaltoElemLocation[]> => {
  if (isObjectType(element)) {
    const locs = await Promise.all(_(element.fields)
      .values()
      .filter(f => fullName === dumpElemID(f.type))
      .map(f => getLocations(workspace, f.elemID.getFullName()))
      .value())
    return _.flatten(locs)
  }
  if (isInstanceElement(element)) {
    const typeDumpName = dumpElemID(element.type)
    return (typeDumpName === fullName)
      ? getLocations(workspace, element.elemID.getFullName())
      : []
  }
  return []
}

export const provideWorkspaceReferences = async (
  workspace: EditorWorkspace,
  token: string
): Promise<SaltoElemLocation[]> => (
  _.flatten(await Promise.all(workspace.elements.map(e => getUsages(workspace, e, token))))
)
