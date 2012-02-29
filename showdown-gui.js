//
// showdown-gui.js
//
// A sample application for Showdown, a javascript port
// of Markdown.
//
// Copyright (c) 2007 John Fraser.
//
// Redistributable under a BSD-style open source license.
// See license.txt for more information.
//
// The full source distribution is at:
//
//				A A L
//				T C A
//				T K B
//
//   <http://www.attacklab.net/>
//

//
// The Showdown converter itself is in showdown.js, which must be
// included by the HTML before this file is.
//
// showdown-gui.js assumes the id and class definitions in
// showdown.html.  It isn't dependent on the CSS, but it does
// manually hide, display, and resize the individual panes --
// overriding the stylesheets.
//
// This sample application only interacts with showdown.js in
// two places:
//
//  In startGui():
//
//      converter = new Showdown.converter();
//
//  In convertText():
//
//      text = converter.makeHtml(text);
//
// The rest of this file is user interface stuff.
//


//
// Register for onload
//
window.onload = startGui;


//
// Globals
//
var maxDelay = 3000; // longest update pause (in ms)
var converter;
var processingTime, convertTextTimer;
var lastText, lastOutput, lastHeightLeft;
var inputACEditor, outputACEditor, syntaxACEditor;
var inputPane, outputPane, syntaxPane, previewPane;
var paneSetting, convertTextButton, convertTextSetting;


//
//	Initialization
//
function startGui() {
	// find elements
	paneSetting = document.getElementById("paneSetting");
	convertTextButton = document.getElementById("convertTextButton");
	convertTextSetting = document.getElementById("convertTextSetting");

	inputPane = document.getElementById("inputPane");
	outputPane = document.getElementById("outputPane");
	syntaxPane = document.getElementById("syntaxPane");
	previewPane = document.getElementById("previewPane");

	// set event handlers
	window.onresize = setPaneHeight;

	paneSetting.onchange = onPaneSettingChanged;
	convertTextButton.onclick = onConvertTextButtonClicked;
	convertTextSetting.onchange = onConvertTextSettingChanged;

	// First, try registering for keyup events
	// (There's no harm in calling onInput() repeatedly)
	window.onkeyup = inputPane.onkeyup = onInput;

	// In case we can't capture paste events, poll for them
	var pollingFallback = window.setInterval(function(){
		if(inputACEditor.getSession().getValue() != lastText)
			onInput();
	},1000);

	// Try registering for paste events
	inputPane.onpaste = function() {
		// It worked! Cancel paste polling.
		if (pollingFallback!=undefined) {
			window.clearInterval(pollingFallback);
			pollingFallback = undefined;
		}
		onInput();
	}

	// Try registering for input events (the best solution)
	if (inputPane.addEventListener) {
		// Let's assume input also fires on paste.
		// No need to cancel our keyup handlers;
		// they're basically free.
		inputPane.addEventListener("input",inputPane.onpaste,false);
	}

	// poll for changes in font size
	// this is cheap; do it often
	window.setInterval(setPaneHeight,250);

	var inputContent = getInnerText(inputPane).replace(/(^\s*)|(\s*$)/g,'');
	inputACEditor = initialACEditor("inputPane","markdown");
	inputACEditor.getSession().setValue(inputContent);
	inputACEditor.setTheme("ace/theme/twilight");

	inputPane.style.display="block";
	previewPane.style.display="block";

	// start with blank page?
	if (top.document.location.href.match(/\?blank=1$/))
		inputACEditor.getSession().setValue("");

	// refresh panes to avoid a hiccup
	onPaneSettingChanged();

	// build the converter
	converter = new Showdown.converter();

	// do an initial conversion to avoid a hiccup
	convertText();

	// give the input pane focus
	inputPane.focus();

	// start the other panes at the top
	// (our smart scrolling moved them to the bottom)
	outputPane.scrollTop = 0;
	previewPane.scrollTop = 0;
}

//
//	Initial ACEditor
//
function initialACEditor(pane,mode) {
	var ACEditor;
	var editorMode;
	ACEditor = ace.edit(pane);
	ACEditor.setShowPrintMargin(true);
	ACEditor.getSession().setValue("the new text here");
	ACEditor.getSession().setTabSize(4);
	ACEditor.getSession().setUseSoftTabs(true);
	ACEditor.getSession().setUseWrapMode(true);
	if (mode == "markdown") {
		editorMode = require("ace/mode/markdown").Mode;
	} else if (mode == "html") {
		editorMode = require("ace/mode/html").Mode;
	}
	ACEditor.getSession().setMode(new editorMode());
	return ACEditor;
}

//
//	Conversion
//
function convertText() {
	// get input text
	var text = inputACEditor.getSession().getValue();

	// if there's no change to input, cancel conversion
	if (text && text == lastText) {
		return;
	} else {
		lastText = text;
	}

	var startTime = new Date().getTime();

	// Do the conversion
	text = converter.makeHtml(text);

	var endTime = new Date().getTime();

	// display processing time
	processingTime = endTime - startTime;
	document.getElementById("processingTime").innerHTML = "Processing Time:&nbsp;&nbsp;" + processingTime +"&nbsp;ms";

	// save proportional scroll positions
	saveScrollPositions();
	// update right pane
	if (paneSetting.value == "outputPane") {
		// the output pane is selected
		outputACEditor = initialACEditor("outputPane","html");
		outputACEditor.getSession().setValue(text);
		outputACEditor.setReadOnly(true);
	} else if (paneSetting.value == "previewPane") {
		// the preview pane is selected
		previewPane.innerHTML = text;
	}

	lastOutput = text;

	// Highlight syntax
	selected_languages = LANGUAGES;
	var pres = document.getElementsByTagName('pre');
	for (var i = 0; i < pres.length; i++) {
		if (pres[i].firstChild && pres[i].firstChild.nodeName == 'CODE')
			initHighlight(pres[i].firstChild);
	}

	// restore proportional scroll positions
	restoreScrollPositions();
}


//
//	Event handlers
//
function onInput() {
// In "delayed" mode, we do the conversion at pauses in input.
// The pause is equal to the last runtime, so that slow
// updates happen less frequently.
//
// Use a timer to schedule updates.  Each keystroke
// resets the timer.

	// if we already have convertText scheduled, cancel it
	if (convertTextTimer) {
		window.clearTimeout(convertTextTimer);
		convertTextTimer = undefined;
	}

	if (convertTextSetting.value != "manual") {
		var timeUntilConvertText = 0;
		if (convertTextSetting.value == "delayed") {
			// make timer adaptive
			timeUntilConvertText = processingTime;
		}

		if (timeUntilConvertText > maxDelay)
			timeUntilConvertText = maxDelay;

		// Schedule convertText().
		// Even if we're updating every keystroke, use a timer at 0.
		// This gives the browser time to handle other events.
		convertTextTimer = window.setTimeout(convertText,timeUntilConvertText);
	}
}

function onPaneSettingChanged() {
	previewPane.style.display = "none";
	outputPane.style.display = "none";
	syntaxPane.style.display = "none";

	// now make the selected one visible
	top[paneSetting.value].style.display = "block";

	lastHeightLeft = 0;  // hack: force resize of new pane

	setPaneHeight();

	if (paneSetting.value == "syntaxPane") {
		// Update syntax pane
		var syntaxContent = getInnerText(syntaxPane).replace(/(^\s*)|(\s*$)/g,'');
		syntaxACEditor=initialACEditor("syntaxPane","markdown");
		syntaxACEditor.getSession().setValue(syntaxContent);
		syntaxACEditor.setReadOnly(true);
	} else if (paneSetting.value == "outputPane") {
		// Update output pane
		outputACEditor=initialACEditor("outputPane","html");
		outputACEditor.getSession().setValue(lastOutput);
		outputACEditor.setReadOnly(true);
	} else if (paneSetting.value == "previewPane") {
		// Update preview pane
		previewPane.innerHTML = lastOutput;
	}
}

function onConvertTextButtonClicked() {
	// hack: force the converter to run
	lastText = "";

	convertText();
	inputPane.focus();
}

function onConvertTextSettingChanged() {
	// If the user just enabled automatic
	// updates, we'll do one now.
	onInput();
}

//
// Smart scrollbar adjustment
//
// We need to make sure the user can't type off the bottom
// of the preview and output pages.  We'll do this by saving
// the proportional scroll positions before the update, and
// restoring them afterwards.
//

var outputScrollPos;
var previewScrollPos;

function getScrollPos(element) {
	// favor the bottom when the text first overflows the window
	if (element.scrollHeight <= element.clientHeight)
		return 1.0;
	return element.scrollTop/(element.scrollHeight-element.clientHeight);
}

function setScrollPos(element,pos) {
	element.scrollTop = (element.scrollHeight - element.clientHeight) * pos;
}

function saveScrollPositions() {
	outputScrollPos = getScrollPos(outputPane);
	previewScrollPos = getScrollPos(previewPane);
}

function restoreScrollPositions() {
	// hack for IE: setting scrollTop ensures scrollHeight
	// has been updated after a change in contents
	previewPane.scrollTop = previewPane.scrollTop;

	setScrollPos(outputPane,outputScrollPos);
	setScrollPos(previewPane,previewScrollPos);
}

//
// Textarea resizing
//
// Some browsers (i.e. IE) refuse to set textarea
// percentage heights in standards mode. (But other units?
// No problem.  Percentage widths? No problem.)
//
// So we'll do it in javascript.  If IE's behavior ever
// changes, we should remove this crap and do 100% textarea
// heights in CSS, because it makes resizing much smoother
// on other browsers.
//

function getTopOffset(element) {
	var sum = element.offsetTop;
	while(element = element.offsetParent)
		sum += element.offsetTop;
	return sum;
}

function getWindowHeight(element) {
	if (window.innerHeight)
		return window.innerHeight;
	else if (document.documentElement && document.documentElement.clientHeight)
		return document.documentElement.clientHeight;
	else if (document.body)
		return document.body.clientHeight;
}

function getElementHeight(element) {
	var height = element.clientHeight;
	if (!height) height = element.scrollHeight;
	return height;
}

function setPaneHeight() {
	var pageFooter = document.getElementById("pageFooter");

	var awayTop = getTopOffset(inputPane);
	var windowHeight = getWindowHeight();
	var footerHeight = getElementHeight(pageFooter);

	// figure out how much room the panes should fill
	var heightLeft = windowHeight - footerHeight - awayTop;

	if (heightLeft < 0) heightLeft = 0;

	// if it hasn't changed, return
	if (heightLeft == lastHeightLeft) {
		return;
	}

	lastHeightLeft = heightLeft;

	// resize all panes
	inputPane.style.height = heightLeft + "px";
	outputPane.style.height = heightLeft + "px";
	syntaxPane.style.height = heightLeft + "px";
	previewPane.style.height = heightLeft + "px";
}

function getInnerText(element) {
	return (typeof element.textContent == 'string') ? element.textContent : element.innerText;
}

function setInnerText(element, text){
	if (typeof element.textContent == 'string') {
		element.textContent = text;
	} else {
		element.innerText = text;
	}
}
