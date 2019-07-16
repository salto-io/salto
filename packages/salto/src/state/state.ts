import { Element, InstanceElement, Type } from "adapter-api"

/**
 * Salto state - an interface for managing the state between runs
 */
export interface SaltoState {
    /**
     * This method save the state
     * @param elements the elements to save
     */
    saveState(elements: (Type | InstanceElement)[]): Promise<void>

    /**
     * Retrieves the latest state saved
     * @returns the elements that represent the last saved state
     */
    getLastState(): Promise<Element[]>
}