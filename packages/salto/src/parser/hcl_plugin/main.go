package main

import (
	"syscall/js"

	"github.com/hashicorp/hcl2/hcl"
	"github.com/hashicorp/hcl2/hcl/hclsyntax"
)

func parseHCL(src []byte, filename string) (*hcl.File, hcl.Diagnostics) {
	return hclsyntax.ParseConfig(src, filename, hcl.InitialPos)
}

// main communicates with javascript by looking at a global object
// we use this method because go does not support exporting functions in web assembly yet
// see: https://github.com/golang/go/issues/25612
func main() {
	args := js.Global().Get("hclParserArgs")

	// Get input parameters
	src := []byte(args.Get("src").String())
	filename := args.Get("filename").String()

	// Parse
	body, parseErrs := parseHCL(src, filename)

	// Serialize the body to a javascript compatible object
	jsMaker := newHclConverter("#")
	convErrs := hclsyntax.Walk(body.Body.(*hclsyntax.Body), jsMaker)

	// Extract meaningful errors to report back
	parseErrTxt := make([]interface{}, len(parseErrs))
	for i, err := range parseErrs {
		parseErrTxt[i] = err.Summary
	}
	convErrsTxt := make([]interface{}, len(convErrs))
	for i, err := range convErrs {
		convErrsTxt[i] = err.Summary
	}

	// Set return value
	js.Global().Set("hclParserReturn", map[string]interface{}{
		"value": jsMaker.JSValue,
		"errors": map[string]interface{}{
			"parse":   parseErrTxt,
			"convert": convErrsTxt,
		},
	})
}
