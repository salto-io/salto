import * as Diff from 'diff'
import { Element } from 'adapter-api'
import { dump } from 'salto'

export type UnifiedDiff = string

export const getActionName = (before?: Element, after?: Element, presentSimpleForm = true): string => {
	const getActionType = (): string => {
		if (before && after) return (presentSimpleForm) ? 'Modify' : 'Modifing'
		if (before) return (presentSimpleForm) ? 'Delete' : 'Deleting'
		return (presentSimpleForm) ? 'Add' : 'Adding'
	}	
	const baseElement = (before || after) as Element 
	return `${getActionType()} ${baseElement.elemID.getFullName()}`
}

export const createChangeDiff = async (stepIndex: number, before?: Element, after?: Element): Promise<UnifiedDiff> => {
	const beforeHCL = before ? await dump([before]) : ''
	const afterHCL = after ? await dump([after]) : ''
	const step = `Step ${stepIndex} - `
	const patchName = `${step}${getActionName(before, after)}`
	return Diff.createPatch(
		patchName, 
		beforeHCL, 
		afterHCL,
	)
}