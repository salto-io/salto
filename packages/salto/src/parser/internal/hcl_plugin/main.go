package main

import (
	"syscall/js"

	"github.com/hashicorp/hcl2/hcl"
	"github.com/hashicorp/hcl2/hcl/hclsyntax"
	"github.com/hashicorp/hcl2/hclwrite"
)

func convertAllDiagnostics(
	parserErrs hcl.Diagnostics,
	traversalErrs hcl.Diagnostics,
) []interface{} {
	result := make([]interface{}, 0, len(parserErrs)+len(traversalErrs))

	for _, err := range parserErrs {
		result = append(result, convertDiagnostic(err))
	}

	for _, err := range traversalErrs {
		result = append(result, convertDiagnostic(err))
	}

	return result
}

// ParseHCL parses a buffer with HCL data and returns the structure
// Args:
// 	args: a js object that contains the following fields
//		content: buffer with data to parse
// 		filename: the filename to include in error messages
//
// Returns:
// 	a js object that contains the following fields
//	  body: The parsed body
// 		errors: a list of error strings
func ParseHCL(this js.Value, args []js.Value) interface{} {
	// Get input parameters
	content := []byte(args[0].String())
	filename := args[1].String()

	// Parse
	body, parseErrs := hclsyntax.ParseConfig(content, filename, hcl.InitialPos)

	// Serialize the body to a javascript compatible object
	jsMaker := newHclConverter("#")
	convErrs := hclsyntax.Walk(body.Body.(*hclsyntax.Body), jsMaker)

	return map[string]interface{}{
		"body":   jsMaker.JSValue,
		"errors": convertAllDiagnostics(parseErrs, convErrs),
	}
}

// DumpHCL formats blocks to HCL syntax
// Args:
//  args: a js object that contains the following fields
//    body: an object to be serialized to HCL
//
// Returns:
//  A buffer with the serialized HCL
func DumpHCL(this js.Value, args []js.Value) interface{} {
	file := hclwrite.NewEmptyFile()
	fillBody(file.Body(), args[0])
	return string(format(file.Bytes()))
}

var exportedFuncs = map[string]func(this js.Value, args []js.Value) interface{}{
	"parse": ParseHCL,
	"dump": DumpHCL,
}

const globalModuleName = "saltoGoHclParser"

// main communicates with javascript by looking at a global object
// we use this method because go does not support exporting functions in web assembly yet
// see: https://github.com/golang/go/issues/25612
func main() {
	done := make(chan interface{})

	js.Global().Set(globalModuleName, make(map[string]interface{}))
	module := js.Global().Get(globalModuleName)

	jsFuncs := []js.Func{}
	for funcName, funcVal := range exportedFuncs {
		jsFunc := js.FuncOf(funcVal)
		jsFuncs = append(jsFuncs, jsFunc)
		module.Set(funcName, jsFunc)
	}

	var stopFunc js.Func
	stopFunc = js.FuncOf(func(this js.Value, args []js.Value) interface {} {
		for _, jsFunc := range jsFuncs {
			jsFunc.Release()
		}
		go func() {
			stopFunc.Release()
		}()
		js.Global().Set(globalModuleName, js.Null())
		done <- true
		return 0
	})

	module.Set("stop", stopFunc)
	<-done
}
