import { isObjectType, isInstanceElement, getField } from 'adapter-api'
import { SaltoWorkspace } from './workspace'
import { PositionContext } from './context'
import { getLocations, SaltoElemLocation } from './location'

export const provideWorkspaceDefinition = (
  workspace: SaltoWorkspace,
  context: PositionContext,
  token: string
): SaltoElemLocation[] => {
  if (context.ref && isInstanceElement(context.ref.element)) {
    const refPath = (context.ref.path)
      ? context.ref.path.replace(new RegExp(`${token}$`), '')
      : context.ref.path
    const refType = (refPath)
      ? getField(context.ref.element.type, refPath.split(' '))
      : context.ref.element.type
    // If we are inside an instance obj, we look for the *field* definitions by
    // field name
    if (isObjectType(refType)) {
      const refField = refType.fields[token]
      const fullName = (refField) ? refField.elemID.getFullName() : token
      return getLocations(workspace, fullName)
    }
  }
  // We are not in instance, so we can just look the current token
  return getLocations(workspace, token)
}
