import _ from 'lodash'

import { Element, isObjectType, isInstanceElement } from 'adapter-api'
import { getLocations, SaltoElemLocation } from './location'
import { SaltoWorkspace } from './workspace'

// TODO - Note that this will have no great performances untill we will get the 
// reverse SM from salto's core. This is acceptable as this is not called so often
const getUsages = (
	workspace: SaltoWorkspace, 
	element: Element, 
	fullName: string
): SaltoElemLocation[] => {
	if (isObjectType(element)) {
		return _(element.fields)
				 .values()
		         .filter(f => fullName === f.type.elemID.getFullName())
		         .map(f => getLocations(workspace, f.elemID.getFullName()))
		         .flatten()
		         .value()
	}
	if (isInstanceElement(element)) {
		const typeFullName = element.type.elemID.getFullName()
		return (typeFullName === fullName) ? getLocations(workspace, element.elemID.getFullName()) : 
											 []
	}
	return []
}

export const provideWorkspaceReferences = (workspace: SaltoWorkspace, token: string): SaltoElemLocation[] => (
	_.reduce(
		workspace.mergedElements,
		(acc, e) => ([...acc, ...getUsages(workspace, e, token)]),
		[] as SaltoElemLocation[]
	)
)