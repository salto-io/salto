"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("lodash"));
/**
 * Defines the list of supported types.
 */
var PrimitiveTypes;
(function (PrimitiveTypes) {
    PrimitiveTypes[PrimitiveTypes["STRING"] = 0] = "STRING";
    PrimitiveTypes[PrimitiveTypes["NUMBER"] = 1] = "NUMBER";
    PrimitiveTypes[PrimitiveTypes["BOOLEAN"] = 2] = "BOOLEAN";
    PrimitiveTypes[PrimitiveTypes["OBJECT"] = 3] = "OBJECT";
    PrimitiveTypes[PrimitiveTypes["LIST"] = 4] = "LIST";
})(PrimitiveTypes = exports.PrimitiveTypes || (exports.PrimitiveTypes = {}));
class TypeID {
    constructor(args) {
        this.name = args.name;
        this.adapter = args.adapter;
    }
    getFullName() {
        return [this.adapter, this.name]
            .filter(part => !_.isEmpty(part))
            .join(TypeID.NAMESPACE_SEPERATOR);
    }
}
TypeID.NAMESPACE_SEPERATOR = '_';
exports.TypeID = TypeID;
/**
 * An abstract class that represent the base type.
 * Contains the base function and fields.
 * Each subclass needs to implement the clone function as it is members
 * dependent.
 */
class Type {
    constructor({ annotations, annotationsValues, typeID, }) {
        this.annotations = annotations;
        this.annotationsValues = annotationsValues;
        this.typeID = typeID;
        // Prevents reregistration of clones, we only want to register
        // first creation
    }
    /**
     * Return a deep copy of the instance annotations by recursivally
     * cloning all annotations (by invoking their clone method)
     */
    cloneAnnotations() {
        const clonedAnnotations = {};
        Object.keys(this.annotations).forEach((key) => {
            clonedAnnotations[key] = this.annotations[key].clone();
        });
        return clonedAnnotations;
    }
    /**
     * Return a deep copy of the instance annotations values.
     */
    cloneAnnotationsValues() {
        return _.cloneDeep(this.annotationsValues);
    }
    annotate(annotationsValues) {
        // Should we overide? I'm adding right now as it seems more
        // usefull. (Roi R)
        Object.keys(annotationsValues).forEach((key) => {
            this.annotationsValues[key] = annotationsValues[key];
        });
    }
}
Type.DEFAULT = '_default';
exports.Type = Type;
/**
 * Defines a type that represents a primitive value (This comment WAS NOT auto generated)
 */
class PrimitiveType extends Type {
    constructor({ typeID, primitive, annotations = {}, annotationsValues = {}, }) {
        super({ typeID, annotations, annotationsValues });
        this.primitive = primitive;
    }
    /**
     * Return an independent copy of this instance.
     * @return {PrimitiveType} the cloned instance
     */
    clone(additionalAnnotationsValues = {}) {
        const res = new PrimitiveType({
            typeID: this.typeID,
            primitive: this.primitive,
            annotations: this.cloneAnnotations(),
            annotationsValues: this.cloneAnnotationsValues(),
        });
        res.annotate(additionalAnnotationsValues);
        return res;
    }
}
exports.PrimitiveType = PrimitiveType;
/**
 * Defines a type that represents an object (Also NOT auto generated)
 */
class ObjectType extends Type {
    constructor({ typeID, fields = {}, annotations = {}, annotationsValues = {}, }) {
        super({ typeID, annotations, annotationsValues });
        this.fields = fields;
    }
    cloneFields() {
        const clonedFields = {};
        Object.keys(this.fields).forEach((key) => {
            clonedFields[key] = this.fields[key].clone();
        });
        return clonedFields;
    }
    /**
     * Return an independent copy of this instance.
     * @return {ObjectType} the cloned instance
     */
    clone(additionalAnnotationsValues = {}) {
        const clonedAnnotations = this.cloneAnnotations();
        const clonedAnnotationValues = this.cloneAnnotationsValues();
        const clonedFields = this.cloneFields();
        const res = new ObjectType({
            typeID: this.typeID,
            fields: clonedFields,
            annotations: clonedAnnotations,
            annotationsValues: clonedAnnotationValues,
        });
        res.annotate(additionalAnnotationsValues);
        return res;
    }
}
exports.ObjectType = ObjectType;
/**
 * Defines a type that represents an array (OK I DID copy paste from prev comments.)
 */
class ListType extends Type {
    constructor({ typeID, elementType, annotations = {}, annotationsValues = {}, }) {
        super({ typeID, annotations, annotationsValues });
        this.elementType = elementType;
    }
    /**
     * Return an independent copy of this instance.
     * @return {ListType} the cloned instance
     */
    clone(additionalAnnotationsValues = {}) {
        const clonedElementType = this.elementType
            ? this.elementType.clone()
            : undefined;
        const clonedAnnotations = this.cloneAnnotations();
        const clonedAnnotationValues = this.cloneAnnotationsValues();
        const res = new ListType({
            typeID: this.typeID,
            elementType: clonedElementType,
            annotations: clonedAnnotations,
            annotationsValues: clonedAnnotationValues,
        });
        res.annotate(additionalAnnotationsValues);
        return res;
    }
}
exports.ListType = ListType;
class TypesRegistry {
    constructor(initTypes = []) {
        this.registeredTypes = {};
        initTypes.forEach(type => this.registerType(type));
    }
    registerType(typeToRegister) {
        const key = typeToRegister.typeID.getFullName();
        const existingType = this.registeredTypes[key];
        if (existingType) {
            throw new Error('Type extension is not supported for now');
        }
        this.registeredTypes[key] = typeToRegister;
    }
    hasType(typeID) {
        const fullName = typeID.getFullName();
        return Object.prototype.hasOwnProperty.call(this.registeredTypes, fullName);
    }
    getAllTypes() {
        return Object.values(this.registeredTypes);
    }
    getType(typeID, type = PrimitiveTypes.OBJECT) {
        // Using any here is ugly, but I can't find a better comiling solution. TODO - fix this
        const key = typeID.getFullName();
        let res = this.registeredTypes[key];
        if (!res) {
            if (type === PrimitiveTypes.OBJECT) {
                res = new ObjectType({ typeID });
            }
            else if (type === PrimitiveTypes.LIST) {
                res = new ListType({ typeID });
            }
            else {
                res = new PrimitiveType({ typeID, primitive: type });
            }
            this.registerType(res);
        }
        return res;
    }
    merge(otherRegistry) {
        const allTypes = this.getAllTypes().concat(otherRegistry.getAllTypes());
        return new TypesRegistry(allTypes);
    }
}
exports.TypesRegistry = TypesRegistry;
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function isObjectType(element) {
    return element instanceof ObjectType;
}
exports.isObjectType = isObjectType;
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function isListType(element) {
    return element instanceof ListType;
}
exports.isListType = isListType;
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function isPrimitiveType(element) {
    return element instanceof PrimitiveType;
}
exports.isPrimitiveType = isPrimitiveType;
//# sourceMappingURL=elements.js.map