import _ from 'lodash'

export const validateAndDefaultServices = (
  workspaceServices: string[],
  inputServices?: string[]
): string[] => {
  if (workspaceServices.length === 0) {
    throw new Error('No services are configured for this workspace. Use \'salto services add\'.')
  }

  // This assumes the default value for input services is all configured
  // so use the default (workspace services) if nothing was inputted
  if (!inputServices) {
    return workspaceServices
  }

  const diffServices = _.difference(inputServices, workspaceServices || [])
  if (diffServices.length > 0) {
    throw new Error(`Not all services (${diffServices}) are set up for this workspace`)
  }
  return inputServices
}
