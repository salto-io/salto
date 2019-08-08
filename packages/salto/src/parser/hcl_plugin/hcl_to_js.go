package main

import (
	"github.com/hashicorp/hcl2/hcl"
	"github.com/hashicorp/hcl2/hcl/hclsyntax"
	"github.com/zclconf/go-cty/cty"
)
// convertValue converts a cty.Value to the appropriate go native type so that it can be
// serialized to javascript
func convertValue(val cty.Value, path string) interface{} {
	t := val.Type()
	switch {
	case t.HasDynamicTypes():
		// Dynamic type means this is an expression that has external references
		// We do not support this scenario yet but for now we also don't want to crash
		return "*** dynamic ***"

	case !val.IsKnown():
		// This can happen with "<<EOF" type expressions that also reference variables
		// We do not support this scenario yet but for now we also don't want to crash
		return "*** unknown ***"

	case t.IsTupleType():
		res := make([]interface{}, val.LengthInt())
		var i int64
		for i = 0; i < int64(val.LengthInt()); i++ {
			res[i] = convertValue(val.Index(cty.NumberIntVal(i)), path+"."+string(i))
		}
		return res

	case t.IsObjectType():
		res := map[string]interface{}{}
		for k, v := range val.AsValueMap() {
			res[k] = convertValue(v, path+"."+k)
		}
		return res

	case t.IsPrimitiveType():
		switch t {
		case cty.String:
			return val.AsString()
		case cty.Number:
			res, _ := val.AsBigFloat().Float64()
			return res
		case cty.Bool:
			return val.True()
		default:
			panic("unknown cty primitve type: " + t.FriendlyName() + " at " + path)
		}

	// We should never get the following types from parsing since they will be parsed as less specific types
	// see https://github.com/hashicorp/hcl2/blob/master/hcl/hclsyntax/spec.md#collection-values
	case t.IsListType():
		panic("lists are not expected here - we expect to get tuple type instead")
	case t.IsMapType():
		panic("maps are not expected here - we expect to get an object type instead")
	}

	panic("unknown type to convert: " + t.FriendlyName() + " at " + path)
}

func convertPos(pos hcl.Pos) map[string]interface{} {
	return map[string]interface{}{
		"line": pos.Line,
		"col":  pos.Column,
		"byte": pos.Byte,
	}
}

func convertSourceRange(src hcl.Range) map[string]interface{} {
	return map[string]interface{}{
		"start":    convertPos(src.Start),
		"end":      convertPos(src.End),
		"filename": src.Filename,
	}
}

// hclConverter walks the HCL tree and converts each node to a native go
// value that can be serialized to javascript later
type hclConverter struct {
	path    string
	JSValue map[string]interface{}

	nestedConverter *hclConverter
}

func newHclConverter(path string) *hclConverter {
	return &hclConverter{
		path:            path,
		JSValue:         map[string]interface{}{},
		nestedConverter: nil,
	}
}

func (maker *hclConverter) EnterExpression(expType string) {
	maker.nestedConverter = newHclConverter(maker.path + "/" + expType)
	maker.nestedConverter.JSValue["expressions"] = []interface{}{}
}

func (maker *hclConverter) AppendExpression(exp map[string]interface{}){
	maker.JSValue["expressions"] = append(
		maker.JSValue["expressions"].([]interface{}), exp,
	)
}

func (maker *hclConverter) ExitExpression( string) {
	maker.AppendExpression(map[string]interface{}{
		"type": expType,
		"expressions" : maker.nestedConverter.JSValue["expressions"],
	})
	maker.nestedConverter = nil	
}

func (maker *hclConverter) ExitLiteralExpression(val cty.Value) {
	maker.AppendExpression(map[string]interface{}{
			"type": "literal",
			"value" : convertValue(val, maker.nestedConverter.path),
	})	
	maker.nestedConverter = nil	
}

func (maker *hclConverter) ExitAttribute(attr *hclsyntax.Attribute) {
	maker.JSValue["attrs"].(map[string]interface{})[attr.Name] = map[string]interface{}{
		"source": convertSourceRange(attr.Range()),
		"expressions" : maker.nestedConverter.JSValue["expressions"],
	}
}


func (maker *hclConverter) Enter(node hclsyntax.Node) hcl.Diagnostics {
	if maker.nestedConverter != nil {
		// Let deepest nested maker handle the new element
		return maker.nestedConverter.Enter(node)
	}

	switch node.(type) {
	case *hclsyntax.Body:
		// Initialize attrs and blocks
		maker.JSValue["attrs"] = map[string]interface{}{}
		maker.JSValue["blocks"] = []interface{}{}

	case hclsyntax.Blocks:
		// This just means we are entering the blocks list, not much to do with it since
		// we will know we are in an block when we get one

	case *hclsyntax.Block:
		blk := node.(*hclsyntax.Block)
		pathAddition := blk.Type
		for _, l := range blk.Labels {
			pathAddition += "_" + l
		}
		maker.nestedConverter = newHclConverter(maker.path + "/" + pathAddition)

	case hclsyntax.Attributes:
		// This just means we are entering the attributes list, not much to do with it since
		// we will know we are in an attribute when we get one

	case *hclsyntax.Attribute:
		attr := node.(*hclsyntax.Attribute)
		maker.EnterExpression(attr.Name)

	case *hclsyntax.TemplateExpr: 
		maker.EnterExpression("template")

	case *hclsyntax.TupleConsExpr: 
		maker.EnterExpression("tuple")

	case *hclsyntax.ObjectConsExpr:
		maker.EnterExpression("map")

	// For now we treat this like a literal
	case *hclsyntax.ObjectConsKeyExpr:
		maker.EnterExpression("literal")

	// We don't really need to create and expression here since the nestedConverter
	// will not hold any values, but it here for consistency with other types
	case *hclsyntax.LiteralValueExpr:
		maker.EnterExpression("literal")
	}

	return hcl.Diagnostics{}
}

func (maker *hclConverter) Exit(node hclsyntax.Node) hcl.Diagnostics {
	if maker.nestedConverter != nil && maker.nestedConverter.nestedConverter != nil {
		// Since every meaningful maker creates a nested maker on Enter, the second to last
		// maker is the one that should handle an Exit
		return maker.nestedConverter.Exit(node)
	}

	switch node.(type) {
	case *hclsyntax.Body:
		// pass
		
	case hclsyntax.Blocks:
		// pass
		
	case *hclsyntax.Block:
		blk := node.(*hclsyntax.Block)
		maker.nestedConverter.JSValue["type"] = blk.Type
		labels := make([]interface{}, len(blk.Labels))
		for i, label := range blk.Labels {
			labels[i] = label
		}
		maker.nestedConverter.JSValue["labels"] = labels
		maker.nestedConverter.JSValue["source"] = convertSourceRange(blk.Range())
		maker.JSValue["blocks"] = append(maker.JSValue["blocks"].([]interface{}), maker.nestedConverter.JSValue)

		maker.nestedConverter = nil

	case hclsyntax.Attributes:
		// pass
		
	case *hclsyntax.Attribute:
		attr := node.(*hclsyntax.Attribute)
		maker.ExitAttribute(attr)
		maker.nestedConverter = nil	

	case *hclsyntax.TemplateExpr: 
		maker.ExitExpression("template")

	case *hclsyntax.TupleConsExpr: 
		maker.ExitExpression("list")

	case *hclsyntax.ObjectConsExpr:
		maker.ExitExpression("map")

	// For now we treat this like a literal
	case *hclsyntax.ObjectConsKeyExpr:
		exp := node.(*hclsyntax.ObjectConsKeyExpr)
		val, evalErrs := exp.Value(nil)
		maker.ExitLiteralExpression(val)
		return evalErrs

	case *hclsyntax.LiteralValueExpr:
		exp := node.(*hclsyntax.LiteralValueExpr)
		val, evalErrs := exp.Value(nil)
		maker.ExitLiteralExpression(val)
		return evalErrs

	}
	return hcl.Diagnostics{}
}
