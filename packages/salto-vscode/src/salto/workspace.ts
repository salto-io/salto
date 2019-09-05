import { Element } from 'adapter-api'
import Parser from 'salto/dist/src/parser/salto'
import Parser from 'salto/dist/src/parser/salto'

type SaltoError = string
interface ElementsMap {
	[key: string]: Element[]
}
interface SaltoWorkspace {
	fileElements: ElementsMap
	mergedElements: Element[]
	errors: SaltoError[]
}

const workspaces : { [key: string] : SaltoWorkspace } = {}

const initWorkspace = async (workspaceName: string, baseDir: string): Promise<void> => {
	const blueprints = loadBlueprints(baseDir)
	const parseResults = blueprints.map( bp => {
		const { elements, errors } = Parser.parse(bp.buffer, bp.filename)
		return { elements, errors, name: bp.filename }
	})
	
}